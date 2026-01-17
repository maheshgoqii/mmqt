//
//  RCTMQTT.mm
//  mmqt
//
//  Created by Mahesh Mestri on 17/01/26.
//

#import "RCTMQTT.h"
#import <NativeMQTTSpec/NativeMQTTSpec.h>

using namespace facebook::react;

@implementation RCTMQTT

+ (NSString *)moduleName {
  return @"RCTMQTT";
}

- (std::shared_ptr<TurboModule>)getTurboModule:
(const ObjCTurboModule::InitParams &)params
{
  // 🔑 THIS LINE IS REQUIRED FOR TURBOMODULES
  return std::make_shared<NativeMQTTSpecJSI>(params);
}

#pragma mark - Event Emitter Stubs

- (void)addListener:(nonnull NSString *)eventType {
  // No-op stub
}

- (void)removeListeners:(double)count {
  // No-op stub
}

#pragma mark - Lifecycle

- (void)initialize:(JS::NativeMQTT::MQTTConfig &)config
        sslConfig:(JS::NativeMQTT::MQTTSSLConfig &)sslConfig
       willConfig:(JS::NativeMQTT::MQTTWillConfig &)willConfig
          resolve:(RCTPromiseResolveBlock)resolve
           reject:(RCTPromiseRejectBlock)reject
{
  if (resolve) {
    resolve(@(YES));
  }
}

- (void)destroy:(RCTPromiseResolveBlock)resolve
         reject:(RCTPromiseRejectBlock)reject
{
  if (resolve) {
    resolve(@(YES));
  }
}

#pragma mark - Connection

- (void)connect:(RCTPromiseResolveBlock)resolve
         reject:(RCTPromiseRejectBlock)reject
{
  if (resolve) {
    resolve(@(YES));
  }
}

- (void)disconnect:(RCTPromiseResolveBlock)resolve
            reject:(RCTPromiseRejectBlock)reject
{
  if (resolve) {
    resolve(@(YES));
  }
}

- (void)reconnect:(RCTPromiseResolveBlock)resolve
           reject:(RCTPromiseRejectBlock)reject
{
  if (resolve) {
    resolve(@(YES));
  }
}

- (void)isConnected:(RCTPromiseResolveBlock)resolve
             reject:(RCTPromiseRejectBlock)reject
{
  if (resolve) {
    resolve(@(NO));
  }
}

- (void)getConnectionStatus:(RCTPromiseResolveBlock)resolve
                     reject:(RCTPromiseRejectBlock)reject
{
  if (resolve) {
    resolve(@"disconnected");
  }
}

#pragma mark - Messaging

- (void)publish:(nonnull NSString *)topic
         message:(nonnull NSString *)message
         options:(JS::NativeMQTT::MQTTPublishOptions &)options
         resolve:(RCTPromiseResolveBlock)resolve
          reject:(RCTPromiseRejectBlock)reject
{
  if (resolve) {
    resolve(@(YES));
  }
}

- (void)subscribe:(nonnull NSString *)topic
           options:(JS::NativeMQTT::MQTTSubscribeOptions &)options
           resolve:(RCTPromiseResolveBlock)resolve
            reject:(RCTPromiseRejectBlock)reject
{
  if (resolve) {
    resolve(@(YES));
  }
}

- (void)unsubscribe:(nonnull NSString *)topic
             resolve:(RCTPromiseResolveBlock)resolve
              reject:(RCTPromiseRejectBlock)reject
{
  if (resolve) {
    resolve(@(YES));
  }
}

@end
