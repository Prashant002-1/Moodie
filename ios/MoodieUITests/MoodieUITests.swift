import XCTest

final class MoodieUITests: XCTestCase {
    override func setUp() { continueAfterFailure = false }
    @MainActor func testNativeAccountResponseAndPersistenceJourney() throws {
        let app = XCUIApplication()
        let noteText = "Native viewing \(Int(Date().timeIntervalSince1970))."
        app.launch()
        print(app.debugDescription)
        if app.textFields["auth-identifier"].waitForExistence(timeout: 12) {
            app.textFields["auth-identifier"].tap(); app.textFields["auth-identifier"].typeText("ios_viewer")
            app.secureTextFields["auth-password"].tap(); app.secureTextFields["auth-password"].typeText("native-test-password")
            app.buttons["auth-submit"].tap()
        }
        XCTAssertTrue(app.tabBars.buttons["Home"].waitForExistence(timeout: 15))
        let throughPerson = app.staticTexts["Through ananya"]
        for _ in 0..<8 { if throughPerson.exists { break }; app.swipeUp() }
        XCTAssertTrue(throughPerson.waitForExistence(timeout: 15))
        let home = XCTAttachment(screenshot: app.screenshot()); home.name = "Home"; home.lifetime = .keepAlways; add(home)
        app.buttons["Following"].tap()
        let publicNote = "I walked home without headphones after this. For once, the ordinary things felt like enough."
        XCTAssertTrue(app.buttons[publicNote].waitForExistence(timeout: 10))
        let feed = XCTAttachment(screenshot: app.screenshot()); feed.name = "Following responses"; feed.lifetime = .keepAlways; add(feed)
        app.buttons[publicNote].tap()
        XCTAssertTrue(app.textFields["comment-body"].waitForExistence(timeout: 10))
        XCTAssertFalse(app.tabBars.buttons["Home"].isHittable)
        let reading = XCTAttachment(screenshot: app.screenshot()); reading.name = "Reading a response"; reading.lifetime = .keepAlways; add(reading)
        app.navigationBars.buttons.element(boundBy: 0).tap()
        XCTAssertTrue(app.tabBars.buttons["Search"].waitForExistence(timeout: 5))
        app.tabBars.buttons["Search"].tap()
        let search = app.searchFields.firstMatch
        XCTAssertTrue(search.waitForExistence(timeout: 5)); search.tap(); search.typeText("Past Lives")
        let film = app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "Past Lives")).firstMatch
        XCTAssertTrue(film.waitForExistence(timeout: 10)); film.tap()
        let about = app.buttons["More about this film"]
        for _ in 0..<6 { if about.exists && about.isHittable { break }; app.swipeUp() }
        XCTAssertTrue(about.waitForExistence(timeout: 8)); about.tap()
        let less = app.buttons["Show less"]
        for _ in 0..<6 { if less.exists && less.isHittable { break }; app.swipeUp() }
        let expanded = XCTAttachment(screenshot: app.screenshot()); expanded.name = "Optional film details"; expanded.lifetime = .keepAlways; add(expanded)
        less.tap()
        let addResponse = app.buttons["Add response"]
        for _ in 0..<6 { if addResponse.exists && addResponse.isHittable { break }; app.swipeDown() }
        XCTAssertTrue(addResponse.waitForExistence(timeout: 10)); addResponse.tap()
        if app.alerts.buttons["Discard draft and start new"].waitForExistence(timeout: 2) {
            app.alerts.buttons["Discard draft and start new"].tap()
        }
        let note = app.textViews["response-note"].exists ? app.textViews["response-note"] : app.textFields["response-note"]
        XCTAssertTrue(note.waitForExistence(timeout: 5)); note.tap(); note.typeText(noteText)
        if app.toolbars.buttons["Done"].exists { app.toolbars.buttons["Done"].tap() }
        let feeling = app.buttons["feeling-sad"]
        for _ in 0..<8 { if feeling.exists && feeling.isHittable { break }; app.swipeUp() }
        XCTAssertTrue(feeling.waitForExistence(timeout: 5))
        feeling.tap()
        let composer = XCTAttachment(screenshot: app.screenshot()); composer.name = "Composer"; composer.lifetime = .keepAlways; add(composer)
        let save = app.buttons["save-response"]
        XCTAssertTrue(save.waitForExistence(timeout: 5))
        let enabled = XCTNSPredicateExpectation(predicate: NSPredicate(format: "enabled == true"), object: save)
        XCTAssertEqual(XCTWaiter.wait(for: [enabled], timeout: 5), .completed, app.debugDescription)
        app.navigationBars.buttons["Cancel"].tap()
        XCTAssertTrue(app.buttons["Keep draft"].waitForExistence(timeout: 5)); app.buttons["Keep draft"].tap()
        XCTAssertTrue(addResponse.waitForExistence(timeout: 5)); addResponse.tap()
        XCTAssertTrue(app.alerts.buttons["Continue draft"].waitForExistence(timeout: 5))
        app.alerts.buttons["Continue draft"].tap()
        let restoredNote = app.textFields["response-note"]
        XCTAssertTrue(restoredNote.waitForExistence(timeout: 5)); XCTAssertEqual(restoredNote.value as? String, noteText)
        XCTAssertTrue(save.isEnabled)
        save.tap()
        XCTAssertTrue(app.buttons["read-saved-response"].waitForExistence(timeout: 12))
        let receipt = XCTAttachment(screenshot: app.screenshot()); receipt.name = "Saved response"; receipt.lifetime = .keepAlways; add(receipt)
        app.buttons["read-saved-response"].tap()
        XCTAssertTrue(app.staticTexts[noteText].waitForExistence(timeout: 10))
        XCTAssertFalse(app.textFields["response-note"].exists)
        XCTAssertTrue(app.buttons["viewing-history"].waitForExistence(timeout: 5)); app.buttons["viewing-history"].tap()
        XCTAssertTrue(app.buttons["Add another viewing"].waitForExistence(timeout: 5))
        app.navigationBars.buttons.element(boundBy: 0).tap()
        app.navigationBars.buttons.element(boundBy: 0).tap()
        XCTAssertTrue(app.buttons["open-diary-after-save"].waitForExistence(timeout: 5)); app.buttons["open-diary-after-save"].tap()
        XCTAssertTrue(app.staticTexts[noteText].waitForExistence(timeout: 10))
        let diary = XCTAttachment(screenshot: app.screenshot()); diary.name = "Diary"; diary.lifetime = .keepAlways; add(diary)
        app.terminate(); app.launch()
        XCTAssertTrue(app.tabBars.buttons["Diary"].waitForExistence(timeout: 15)); app.tabBars.buttons["Diary"].tap()
        XCTAssertTrue(app.staticTexts[noteText].waitForExistence(timeout: 10))
    }
}
