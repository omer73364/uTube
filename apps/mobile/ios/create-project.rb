# Reproducible project generation; the generated .xcodeproj is committed.
require 'xcodeproj'
require 'json'
Dir.chdir(__dir__)
project = Xcodeproj::Project.new('uTube.xcodeproj')
app = project.new_target(:application, 'uTube', :ios, '16.0')
extension = project.new_target(:app_extension, 'uTubeShare', :ios, '16.0')
version = JSON.parse(File.read('../package.json'))['version']
[app, extension].each do |target|
  target.build_configurations.each do |config|
    config.build_settings.merge!({
      'OTHER_LDFLAGS' => ['$(inherited)', '-lc++'],
      'SWIFT_VERSION' => '5.0', 'MARKETING_VERSION' => version, 'CURRENT_PROJECT_VERSION' => '1',
      'TARGETED_DEVICE_FAMILY' => '1,2', 'CODE_SIGN_STYLE' => 'Automatic',
      'UTUBE_APP_GROUP' => 'group.io.github.omer73364.utube.mobile',
      'ASSETCATALOG_COMPILER_APPICON_NAME' => target == app ? 'AppIcon' : '',
      'CLANG_ENABLE_MODULES' => 'YES', 'ENABLE_USER_SCRIPT_SANDBOXING' => 'NO',
      'LD_RUNPATH_SEARCH_PATHS' => ['$(inherited)', '@executable_path/Frameworks'],
    })
  end
end
{'uTube' => app, 'ShareExtension' => extension}.each do |folder, target|
  group = project.main_group.new_group(folder, folder)
  Dir["#{folder}/*"].sort.each do |path|
    next if path.end_with?('.lproj')
    ref = group.new_file(File.basename(path))
    if path.end_with?('.swift', '.m') then target.source_build_phase.add_file_reference(ref)
    elsif path.end_with?('.storyboard', '.xcprivacy', '.txt') || File.directory?(path) then target.resources_build_phase.add_file_reference(ref)
    end
  end
  target.build_configurations.each do |config|
    config.build_settings['INFOPLIST_FILE'] = "#{folder}/Info.plist"
    config.build_settings['CODE_SIGN_ENTITLEMENTS'] = "#{folder}/#{folder}.entitlements"
    config.build_settings['PRODUCT_BUNDLE_IDENTIFIER'] = folder == 'uTube' ? 'io.github.omer73364.utube.mobile' : 'io.github.omer73364.utube.mobile.share'
  end
end
strings = project.main_group.groups.find { |g| g.name == 'ShareExtension' }.new_variant_group('Localizable.strings')
['en', 'ar'].each { |lang| ref = strings.new_file("#{lang}.lproj/Localizable.strings"); ref.name = lang }
extension.resources_build_phase.add_file_reference(strings)
extension.build_configurations.each { |c| c.build_settings['APPLICATION_EXTENSION_API_ONLY'] = 'YES'; c.build_settings['SKIP_INSTALL'] = 'YES' }
config = project.main_group.new_file("../../../packages/core/update-config.json")
app.resources_build_phase.add_file_reference(config)
app.add_dependency(extension)
embed = app.new_copy_files_build_phase('Embed App Extensions'); embed.dst_subfolder_spec = '13'
embed.add_file_reference(extension.product_reference).settings = { 'ATTRIBUTES' => ['RemoveHeadersOnCopy'] }
package = project.new(Xcodeproj::Project::Object::XCLocalSwiftPackageReference)
package.relative_path = 'UTubeKit'; project.root_object.package_references << package
product = project.new(Xcodeproj::Project::Object::XCSwiftPackageProductDependency)
product.product_name = 'UTubeKit'; app.package_product_dependencies << product
link = project.new(Xcodeproj::Project::Object::PBXBuildFile)
link.product_ref = product; app.frameworks_build_phase.files << link
bundle = app.new_shell_script_build_phase('Bundle React Native code and images')
bundle.shell_script = <<~SH
  set -e
  export PROJECT_ROOT="$PROJECT_DIR/.."
  export REACT_NATIVE_PATH="$PROJECT_DIR/../../../node_modules/react-native"
  WITH_ENVIRONMENT="$REACT_NATIVE_PATH/scripts/xcode/with-environment.sh"
  REACT_NATIVE_XCODE="$REACT_NATIVE_PATH/scripts/react-native-xcode.sh"
  /bin/sh -c "\\\"$WITH_ENVIRONMENT\\\" \\\"$REACT_NATIVE_XCODE\\\""
SH
bundle.always_out_of_date = '1'
tests = project.new_target(:ui_test_bundle, 'uTubeUITests', :ios, '16.0')
tests.add_dependency(app)
group = project.main_group.new_group('uTubeUITests', 'uTubeUITests')
['SmokeTests.swift', 'LiveTests.swift'].each { |name| tests.source_build_phase.add_file_reference(group.new_file(name)) }
tests.build_configurations.each do |config|
  config.build_settings.merge!({'SWIFT_VERSION' => '5.0', 'PRODUCT_BUNDLE_IDENTIFIER' => 'io.github.omer73364.utube.mobile.uitests', 'GENERATE_INFOPLIST_FILE' => 'YES', 'TEST_TARGET_NAME' => 'uTube', 'TARGETED_DEVICE_FAMILY' => '1,2'})
end
project.save
scheme = Xcodeproj::XCScheme.new
scheme.add_build_target(app); scheme.add_test_target(tests); scheme.test_action.build_configuration = 'Release'; scheme.set_launch_target(app); scheme.test_action.should_use_launch_scheme_args_env = false
scheme.test_action.environment_variables = Xcodeproj::XCScheme::EnvironmentVariables.new([{key: 'UTUBE_LIVE_URL', value: '$(UTUBE_LIVE_URL)', enabled: true}])
scheme.save_as(project.path, 'uTube', true)
