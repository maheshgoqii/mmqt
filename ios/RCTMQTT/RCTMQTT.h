//
//  RCTMQQT.h
//  mmqt
//
//  Created by Mahesh Mestri on 17/01/26.
//

#import <React/RCTEventEmitter.h>
#import <NativeMQTTSpec/NativeMQTTSpec.h>

// Fix for generated mmqt-Swift.h missing superclass declaration
#import <React-RCTAppDelegate/RCTDefaultReactNativeFactoryDelegate.h>

NS_ASSUME_NONNULL_BEGIN

@interface RCTMQTT : RCTEventEmitter <NativeMQTTSpec>

@end

NS_ASSUME_NONNULL_END
