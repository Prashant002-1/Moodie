import XCTest

/// Runs unchanged at standard and accessibility text sizes against the disposable API.
final class AdaptiveJourneyTests: XCTestCase {
    override func setUp() { continueAfterFailure = false }

    @MainActor private func show(_ element: XCUIElement, in app: XCUIApplication) {
        for _ in 0..<12 { if element.exists && element.isHittable { return }; app.swipeUp() }
        XCTAssertTrue(element.isHittable, app.debugDescription)
    }
    @MainActor private func capture(_ app: XCUIApplication, _ name: String) {
        let image = XCTAttachment(screenshot: app.screenshot()); image.name = name; image.lifetime = .keepAlways; add(image)
    }
    @MainActor private func signIn(_ app: XCUIApplication) {
        let identifier = app.textFields["auth-identifier"]
        if identifier.waitForExistence(timeout: 8) {
            show(identifier, in: app); identifier.tap(); identifier.typeText("ios_viewer")
            let password = app.secureTextFields["auth-password"]; show(password, in: app)
            password.tap(); password.typeText("native-test-password")
            let submit = app.buttons["auth-submit"]; show(submit, in: app); submit.tap()
        }
        XCTAssertTrue(app.tabBars.buttons["Home"].waitForExistence(timeout: 15))
    }

    @MainActor func testAccountEntryAndUnfinishedProfile() throws {
        let app = XCUIApplication(); app.launch()
        if app.tabBars.buttons["Home"].waitForExistence(timeout: 5) {
            app.tabBars.buttons["Diary"].tap(); app.buttons["Account"].tap()
            let signOut = app.buttons["Sign out"]; show(signOut, in: app); signOut.tap()
            let confirm = app.sheets.buttons["Sign out"]; XCTAssertTrue(confirm.waitForExistence(timeout: 5)); confirm.tap()
        }
        XCTAssertTrue(app.textFields["auth-identifier"].waitForExistence(timeout: 12))
        capture(app, "Sign in")
        app.buttons["Sign up"].tap(); capture(app, "Create an account")
        let signInTab = app.buttons["Sign in"]
        show(signInTab, in: app); signInTab.tap()
        let forgot = app.buttons["Forgot your password?"]; show(forgot, in: app); forgot.tap()
        XCTAssertTrue(app.staticTexts["Recover your account"].waitForExistence(timeout: 5)); capture(app, "Account recovery")
        let back = app.buttons["Back to sign in"]; show(back, in: app); back.tap()
        let identifier = app.textFields["auth-identifier"]
        show(identifier, in: app); identifier.tap(); identifier.typeText("ios_viewer")
        let password = app.secureTextFields["auth-password"]; show(password, in: app); password.tap(); password.typeText("incorrect-password")
        let submit = app.buttons["auth-submit"]; show(submit, in: app); submit.tap()
        let error = app.staticTexts["Email, username, or password is incorrect."]
        XCTAssertTrue(error.waitForExistence(timeout: 10)); show(error, in: app); capture(app, "Sign in error")
        XCTAssertEqual(identifier.value as? String, "ios_viewer")
        // Changing modes clears password fields while keeping the identifier.
        for _ in 0..<12 { if app.buttons["Sign up"].isHittable { break }; app.swipeDown() }
        app.buttons["Sign up"].tap(); show(signInTab, in: app); signInTab.tap()
        show(password, in: app); password.tap(); password.typeText("native-test-password")
        show(submit, in: app); submit.tap()
        XCTAssertTrue(app.tabBars.buttons["Diary"].waitForExistence(timeout: 15)); app.tabBars.buttons["Diary"].tap()
        app.buttons["Account"].tap()
        let bio = app.textFields["account-bio"]; XCTAssertTrue(bio.waitForExistence(timeout: 8))
        capture(app, "Account settings")
        let original = try XCTUnwrap(bio.value as? String)
        bio.tap(); bio.typeText(" Also, quiet endings.")
        let draft = try XCTUnwrap(bio.value as? String)
        XCTAssertNotEqual(draft, original)
        if app.toolbars.buttons["Done"].exists { app.toolbars.buttons["Done"].tap() }
        let publicProfile = app.buttons["Your public profile"]; show(publicProfile, in: app); publicProfile.tap()
        XCTAssertTrue(app.navigationBars["Profile"].waitForExistence(timeout: 8))
        app.navigationBars.buttons.element(boundBy: 0).tap()
        for _ in 0..<8 { if bio.exists && bio.isHittable { break }; app.swipeDown() }
        XCTAssertEqual(bio.value as? String, draft)
        app.navigationBars.buttons["Done"].tap()
        XCTAssertTrue(app.alerts.buttons["Keep editing"].waitForExistence(timeout: 5)); app.alerts.buttons["Keep editing"].tap()
        XCTAssertEqual(bio.value as? String, draft)
        app.navigationBars.buttons["Done"].tap(); app.alerts.buttons["Discard changes"].tap()
        let accountAvailable = XCTNSPredicateExpectation(predicate: NSPredicate(format: "hittable == true"), object: app.buttons["Account"])
        XCTAssertEqual(XCTWaiter.wait(for: [accountAvailable], timeout: 8), .completed)
        app.buttons["Account"].tap(); XCTAssertTrue(bio.waitForExistence(timeout: 5)); XCTAssertEqual(bio.value as? String, original)
        app.navigationBars.buttons["Done"].tap()
    }

    @MainActor func testFeelingDiscoveryAndEmptyStates() throws {
        let app = XCUIApplication(); app.launch(); signIn(app)
        app.tabBars.buttons["Search"].tap(); app.buttons["Feelings"].tap()
        let happy = app.buttons["search-feeling-happy"]; XCTAssertTrue(happy.waitForExistence(timeout: 8)); happy.tap()
        capture(app, "Choose a feeling")
        let commonGround = app.buttons["Your common ground: Whiplash"]
        show(commonGround, in: app); capture(app, "A feeling through a person"); commonGround.tap()
        let sharedNote = app.staticTexts["The last ten minutes made me forget to breathe. I wanted him to stop, and I wanted him to keep going."]
        XCTAssertTrue(sharedNote.waitForExistence(timeout: 8)); show(sharedNote, in: app); capture(app, "Shared film responses")
        let openFilm = app.buttons["connection-open-film"]; show(openFilm, in: app); openFilm.tap()
        XCTAssertTrue(app.buttons["recommend-film"].waitForExistence(timeout: 8)); capture(app, "Film at reading size")
        let related = app.buttons["Related films"]
        show(app.buttons["Responses"], in: app)
        if !related.isHittable { app.buttons["Responses"].swipeLeft() }
        show(related, in: app); related.tap()
        let emptyRelated = app.staticTexts["No related films are available yet."]
        XCTAssertTrue(emptyRelated.waitForExistence(timeout: 10)); show(emptyRelated, in: app); capture(app, "Related films empty state")
        if !app.buttons["Responses"].isHittable { related.swipeRight() }
        app.buttons["Responses"].tap()
        let response = app.buttons["read-response-3"]
        show(response, in: app); response.tap()
        XCTAssertTrue(app.textFields["comment-body"].waitForExistence(timeout: 8)); capture(app, "Reading and commenting")
        app.terminate(); app.launch(); XCTAssertTrue(app.tabBars.buttons["People"].waitForExistence(timeout: 15))
        app.tabBars.buttons["People"].tap(); let peopleSearch = app.searchFields.firstMatch
        peopleSearch.tap(); peopleSearch.typeText("nobodywiththisname")
        let noPeople = app.staticTexts["No people found"]; XCTAssertTrue(noPeople.waitForExistence(timeout: 8)); capture(app, "People search empty state")
        app.buttons["Clear search"].tap(); XCTAssertTrue(app.buttons["member-hiro"].waitForExistence(timeout: 8))
        if app.navigationBars.buttons["Close"].isHittable { app.navigationBars.buttons["Close"].tap() }
        else if app.navigationBars.buttons["Cancel"].isHittable { app.navigationBars.buttons["Cancel"].tap() }
        app.tabBars.buttons["Search"].tap(); let search = app.searchFields["Search films"]
        XCTAssertTrue(search.waitForExistence(timeout: 5))
        search.tap(); search.typeText("notafilminthefixture")
        let noFilms = app.staticTexts["No films found"]
        XCTAssertTrue(noFilms.waitForExistence(timeout: 10)); capture(app, "Film search empty state")
        XCTAssertEqual(search.value as? String, "notafilminthefixture")
    }
}
