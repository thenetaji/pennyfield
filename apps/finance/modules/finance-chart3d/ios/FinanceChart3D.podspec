Pod::Spec.new do |s|
  s.name           = 'FinanceChart3D'
  s.version        = '0.1.0'
  s.summary        = "Draws spending with Apple's 3D charts."
  s.description    = s.summary
  s.license        = 'MIT'
  s.author         = 'thenetaji'
  s.homepage       = 'https://github.com/thenetaji/pennyfield'
  s.platforms      = { :ios => '16.4' }
  s.swift_version  = '5.9'
  s.source         = { git: 'https://github.com/thenetaji/pennyfield.git' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.source_files = '**/*.{h,m,swift}'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES', 'SWIFT_COMPILATION_MODE' => 'wholemodule' }
end
