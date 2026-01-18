#import "RCTMQTT.h"
#import <React/RCTLog.h>
#import "mmqt-Swift.h"

using namespace facebook::react;

@implementation RCTMQTT

+ (NSString *)moduleName { return @"RCTMQTT"; }

- (instancetype)init {
  if (self = [super init]) {
    __weak __typeof(self) weakSelf = self;
    NSString *ident = [NSString stringWithFormat:@"%p", self];
    [MQTTService.shared addObserverWithIdentifier:ident callback:^(NSString *event, id body) {
        dispatch_async(dispatch_get_main_queue(), ^{
            if (weakSelf && weakSelf.callableJSModules) {
                [weakSelf sendEventWithName:event body:body ? body : [NSNull null]];
            }
        });
    }];
  }
  return self;
}

- (void)invalidate {
  [MQTTService.shared removeObserverWithIdentifier:[NSString stringWithFormat:@"%p", self]];
  [super invalidate];
}

- (void)dealloc {
  [MQTTService.shared removeObserverWithIdentifier:[NSString stringWithFormat:@"%p", self]];
}

- (std::shared_ptr<TurboModule>)getTurboModule:(const ObjCTurboModule::InitParams &)params {
  return std::make_shared<NativeMQTTSpecJSI>(params);
}

- (NSArray<NSString *> *)supportedEvents {
  return @[@"onConnect", @"onConnectFailure", @"onConnectionLost", @"onDisconnect", @"onReconnect", @"onMessageReceived", @"onPublishSuccess", @"onSubscribeSuccess", @"onUnsubscribeSuccess", @"onDeliveryComplete", @"onDestroy", @"onError"];
}

- (void)addListener:(NSString *)e { [super addListener:e]; }
- (void)removeListeners:(double)c { [super removeListeners:c]; }

#pragma mark - Logic

- (void)initialize:(JS::NativeMQTT::MQTTConfig &)c sslConfig:(JS::NativeMQTT::MQTTSSLConfig &)s willConfig:(JS::NativeMQTT::MQTTWillConfig &)w resolve:(RCTPromiseResolveBlock)res reject:(RCTPromiseRejectBlock)rej {
  NSString *p = c.protocol();
  int port = (int)c.port();
  BOOL ssl = [p isEqualToString:@"wss"] || [p isEqualToString:@"ssl"];
  int ka = c.keepAlive().has_value() ? (int)c.keepAlive().value() : 60;

  if ([p hasSuffix:@"5"]) {
    [MQTTService.shared connectMQTT5WithHost:c.host() port:port clientId:c.clientId() protocol:p useSSL:ssl username:c.username() password:c.password() keepAlive:ka];
  } else {
    [MQTTService.shared connectMQTT311WithHost:c.host() port:port clientId:c.clientId() protocol:p useSSL:ssl username:c.username() password:c.password() keepAlive:ka];
  }
  if (res) res(@YES);
}

- (void)connect:(RCTPromiseResolveBlock)res reject:(RCTPromiseRejectBlock)rej { if (res) res(@YES); }
- (void)disconnect:(RCTPromiseResolveBlock)res reject:(RCTPromiseRejectBlock)rej { [MQTTService.shared disconnect]; if (res) res(@YES); }
- (void)reconnect:(RCTPromiseResolveBlock)res reject:(RCTPromiseRejectBlock)rej { if (res) res(@YES); }
- (void)destroy:(RCTPromiseResolveBlock)res reject:(RCTPromiseRejectBlock)rej { [MQTTService.shared disconnect]; if (res) res(@YES); }

- (void)isConnected:(RCTPromiseResolveBlock)res reject:(RCTPromiseRejectBlock)rej { if (res) res(@([MQTTService.shared isConnected])); }
- (void)getConnectionStatus:(RCTPromiseResolveBlock)res reject:(RCTPromiseRejectBlock)rej { if (res) res([MQTTService.shared isConnected] ? @"connected" : @"disconnected"); }

- (void)publish:(NSString *)t message:(NSString *)m options:(JS::NativeMQTT::MQTTPublishOptions &)o resolve:(RCTPromiseResolveBlock)res reject:(RCTPromiseRejectBlock)rej {
  [MQTTService.shared publishWithTopic:t message:m qos:o.qos().has_value() ? (int)o.qos().value() : 0 retained:o.retained().has_value() ? o.retained().value() : NO];
  if (res) res(@YES);
}

- (void)subscribe:(NSString *)t options:(JS::NativeMQTT::MQTTSubscribeOptions &)o resolve:(RCTPromiseResolveBlock)res reject:(RCTPromiseRejectBlock)rej {
  [MQTTService.shared subscribeWithTopic:t qos:o.qos().has_value() ? (int)o.qos().value() : 0];
  if (res) res(@YES);
}

- (void)unsubscribe:(NSString *)t resolve:(RCTPromiseResolveBlock)res reject:(RCTPromiseRejectBlock)rej {
  [MQTTService.shared unsubscribeWithTopic:t];
  if (res) res(@YES);
}

@end
