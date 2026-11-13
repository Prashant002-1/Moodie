#!/usr/bin/env python3
"""Generate a deterministic Xcode project using only Python's standard library."""
from pathlib import Path
import hashlib, json, plistlib
root = Path(__file__).resolve().parents[1]
project = root / 'Moodie.xcodeproj'
project.mkdir(exist_ok=True)
objects = {}
def uid(key): return hashlib.sha1(key.encode()).hexdigest()[:24].upper()
def add(key, value): objects[uid(key)] = value; return uid(key)
def ref(path, kind): return add(path, dict(isa='PBXFileReference', lastKnownFileType=kind, path=path, sourceTree='<group>'))
def build(key, file): return add('build-'+key, dict(isa='PBXBuildFile', fileRef=file))
sources=[]; resources=[]; files=[]
for p in sorted((root/'Moodie').rglob('*.swift')):
    path=str(p.relative_to(root)); f=ref(path,'sourcecode.swift'); files.append(f); sources.append(build(path,f))
for path, kind in [('Moodie/Resources/Assets.xcassets','folder.assetcatalog'),('Moodie/Resources/PrivacyInfo.xcprivacy','text.xml')]:
    f=ref(path,kind); files.append(f); resources.append(build(path,f))
config_refs={c:ref('Config/'+c+'.xcconfig','text.xcconfig') for c in ['Debug','Release']}
files += list(config_refs.values())
app=add('app-product',dict(isa='PBXFileReference',explicitFileType='wrapper.application',includeInIndex='0',path='Moodie.app',sourceTree='BUILT_PRODUCTS_DIR'))
test_product=add('test-product',dict(isa='PBXFileReference',explicitFileType='wrapper.cfbundle',includeInIndex='0',path='MoodieUITests.xctest',sourceTree='BUILT_PRODUCTS_DIR'))
test_files=[]; test_sources=[]
for p in sorted((root/'MoodieUITests').glob('*.swift')):
    path=str(p.relative_to(root)); f=ref(path,'sourcecode.swift'); test_files.append(f); test_sources.append(build(path,f))
products=add('products',dict(isa='PBXGroup',children=[app,test_product],name='Products',sourceTree='<group>'))
main=add('main-group',dict(isa='PBXGroup',children=files+test_files+[products],sourceTree='<group>'))
package=add('core-package',dict(isa='XCLocalSwiftPackageReference',relativePath='MoodieCore'))
product_dep=add('core-product',dict(isa='XCSwiftPackageProductDependency',package=package,productName='MoodieCore'))
framework=add('core-build',dict(isa='PBXBuildFile',productRef=product_dep))
def phase(key,isa,files): return add(key,dict(isa=isa,buildActionMask='2147483647',files=files,runOnlyForDeploymentPostprocessing='0'))
release_check=add('release-check',dict(isa='PBXShellScriptBuildPhase',buildActionMask='2147483647',files=[],inputPaths=['$(SRCROOT)/scripts/validate_release.py'],outputPaths=[],runOnlyForDeploymentPostprocessing='0',shellPath='/bin/sh',shellScript='/usr/bin/python3 "$SRCROOT/scripts/validate_release.py"',alwaysOutOfDate='1'))
app_phases=[release_check,phase('app-sources','PBXSourcesBuildPhase',sources),phase('app-frameworks','PBXFrameworksBuildPhase',[framework]),phase('app-resources','PBXResourcesBuildPhase',resources)]
base={'ALWAYS_SEARCH_USER_PATHS':'NO','CLANG_ENABLE_MODULES':'YES','CLANG_ENABLE_OBJC_ARC':'YES','CLANG_WARN_DOCUMENTATION_COMMENTS':'YES','GCC_C_LANGUAGE_STANDARD':'gnu17','SWIFT_VERSION':'6.0','IPHONEOS_DEPLOYMENT_TARGET':'18.0','SDKROOT':'iphoneos','ENABLE_USER_SCRIPT_SANDBOXING':'YES'}
def configs(prefix, entries):
    ids=[]
    for name,settings in entries.items():
        v=dict(isa='XCBuildConfiguration',buildSettings=settings,name=name)
        if prefix=='app': v['baseConfigurationReference']=config_refs[name]
        ids.append(add(prefix+'-'+name,v))
    return add(prefix+'-configs',dict(isa='XCConfigurationList',buildConfigurations=ids,defaultConfigurationIsVisible='0',defaultConfigurationName='Release'))
project_configs=configs('project',{name:base | ({'ONLY_ACTIVE_ARCH':'YES','SWIFT_OPTIMIZATION_LEVEL':'-Onone','DEBUG_INFORMATION_FORMAT':'dwarf','ENABLE_TESTABILITY':'YES','SWIFT_ACTIVE_COMPILATION_CONDITIONS':'DEBUG $(inherited)'} if name=='Debug' else {'SWIFT_OPTIMIZATION_LEVEL':'-O','DEBUG_INFORMATION_FORMAT':'dwarf-with-dsym','VALIDATE_PRODUCT':'YES'}) for name in ['Debug','Release']})
app_settings={'PRODUCT_NAME':'Moodie','PRODUCT_BUNDLE_IDENTIFIER':'$(MOODIE_BUNDLE_ID)','INFOPLIST_FILE':'Moodie/Resources/Info.plist','GENERATE_INFOPLIST_FILE':'NO','ASSETCATALOG_COMPILER_APPICON_NAME':'AppIcon','ASSETCATALOG_COMPILER_GLOBAL_ACCENT_COLOR_NAME':'AccentColor','CODE_SIGN_STYLE':'Automatic','DEVELOPMENT_TEAM':'$(MOODIE_TEAM_ID)','TARGETED_DEVICE_FAMILY':'1,2','SUPPORTED_PLATFORMS':'iphoneos iphonesimulator','SUPPORTS_MACCATALYST':'NO','SUPPORTS_MAC_DESIGNED_FOR_IPHONE_IPAD':'NO','LD_RUNPATH_SEARCH_PATHS':'$(inherited) @executable_path/Frameworks','CURRENT_PROJECT_VERSION':'1','MARKETING_VERSION':'1.0.0','SWIFT_EMIT_LOC_STRINGS':'YES','ENABLE_PREVIEWS':'YES'}
app_configs=configs('app',{n:app_settings for n in ['Debug','Release']})
app_target=add('app-target',dict(isa='PBXNativeTarget',buildConfigurationList=app_configs,buildPhases=app_phases,buildRules=[],dependencies=[],name='Moodie',packageProductDependencies=[product_dep],productName='Moodie',productReference=app,productType='com.apple.product-type.application'))
proxy=add('app-proxy',dict(isa='PBXContainerItemProxy',containerPortal=uid('project'),proxyType='1',remoteGlobalIDString=app_target,remoteInfo='Moodie'))
dependency=add('app-dependency',dict(isa='PBXTargetDependency',target=app_target,targetProxy=proxy))
test_configs=configs('test',{n:{'PRODUCT_NAME':'$(TARGET_NAME)','PRODUCT_BUNDLE_IDENTIFIER':'com.prashant.moodie.uitests','GENERATE_INFOPLIST_FILE':'YES','TEST_TARGET_NAME':'Moodie','TARGETED_DEVICE_FAMILY':'1,2','CODE_SIGN_STYLE':'Automatic'} for n in ['Debug','Release']})
test_target=add('test-target',dict(isa='PBXNativeTarget',buildConfigurationList=test_configs,buildPhases=[phase('test-sources','PBXSourcesBuildPhase',test_sources),phase('test-frameworks','PBXFrameworksBuildPhase',[])],buildRules=[],dependencies=[dependency],name='MoodieUITests',productName='MoodieUITests',productReference=test_product,productType='com.apple.product-type.bundle.ui-testing'))
add('project',dict(isa='PBXProject',attributes={'BuildIndependentTargetsInParallel':'YES','LastUpgradeCheck':'2700','TargetAttributes':{app_target:{'CreatedOnToolsVersion':'27.0'},test_target:{'CreatedOnToolsVersion':'27.0','TestTargetID':app_target}}},buildConfigurationList=project_configs,compatibilityVersion='Xcode 15.0',developmentRegion='en',hasScannedForEncodings='0',knownRegions=['en','Base'],mainGroup=main,packageReferences=[package],productRefGroup=products,projectDirPath='',projectRoot='',targets=[app_target,test_target]))
# OpenStep plist serializer. Quote every value so paths with spaces are safe.
def serialize(v,depth=0):
    if isinstance(v,dict): return '{\n'+''.join('\t'*(depth+1)+json.dumps(k)+' = '+serialize(value,depth+1)+';\n' for k,value in v.items())+'\t'*depth+'}'
    if isinstance(v,list): return '( '+', '.join(serialize(x,depth) for x in v)+' )'
    return json.dumps(str(v))
data=dict(archiveVersion='1',classes={},objectVersion='60',objects=objects,rootObject=uid('project'))
(project/'project.pbxproj').write_text('// !$*UTF8*$!\n'+serialize(data)+'\n')
scheme=project/'xcshareddata/xcschemes'; scheme.mkdir(parents=True,exist_ok=True)
def reference(identifier,name): return f'<BuildableReference BuildableIdentifier="primary" BlueprintIdentifier="{identifier}" BuildableName="{name}" BlueprintName="{name.split(".")[0]}" ReferencedContainer="container:Moodie.xcodeproj"/>'
(scheme/'Moodie.xcscheme').write_text(f'''<?xml version="1.0" encoding="UTF-8"?>
<Scheme LastUpgradeVersion="2700" version="1.7">
<BuildAction parallelizeBuildables="YES" buildImplicitDependencies="YES"><BuildActionEntries><BuildActionEntry buildForTesting="YES" buildForRunning="YES" buildForProfiling="YES" buildForArchiving="YES" buildForAnalyzing="YES">{reference(app_target,'Moodie.app')}</BuildActionEntry></BuildActionEntries></BuildAction>
<TestAction buildConfiguration="Debug" selectedDebuggerIdentifier="Xcode.DebuggerFoundation.Debugger.LLDB" selectedLauncherIdentifier="Xcode.IDEFoundation.Launcher.LLDB" shouldUseLaunchSchemeArgsEnv="YES"><Testables><TestableReference skipped="NO">{reference(test_target,'MoodieUITests.xctest')}</TestableReference></Testables></TestAction>
<LaunchAction buildConfiguration="Debug" selectedDebuggerIdentifier="Xcode.DebuggerFoundation.Debugger.LLDB" selectedLauncherIdentifier="Xcode.IDEFoundation.Launcher.LLDB" launchStyle="0" useCustomWorkingDirectory="NO" ignoresPersistentStateOnLaunch="NO" debugDocumentVersioning="YES" allowLocationSimulation="YES"><BuildableProductRunnable runnableDebuggingMode="0">{reference(app_target,'Moodie.app')}</BuildableProductRunnable></LaunchAction>
<ProfileAction buildConfiguration="Release" shouldUseLaunchSchemeArgsEnv="YES" savedToolIdentifier="" useCustomWorkingDirectory="NO" debugDocumentVersioning="YES"><BuildableProductRunnable runnableDebuggingMode="0">{reference(app_target,'Moodie.app')}</BuildableProductRunnable></ProfileAction>
<AnalyzeAction buildConfiguration="Debug"/><ArchiveAction buildConfiguration="Release" revealArchiveInOrganizer="YES"/>
</Scheme>''')
print('Generated ios/Moodie.xcodeproj')
