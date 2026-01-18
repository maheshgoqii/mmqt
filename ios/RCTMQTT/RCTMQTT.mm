#import "RCTMQTT.h"
#import <React/RCTLog.h>

#import "mmqt-Swift.h"

using namespace facebook::react;

@implementation RCTMQTT

+ (NSString *)moduleName {
  return @"RCTMQTT";
}

- (instancetype)init {
  if (self = [super init]) {
    __weak __typeof(self) weakSelf = self;
    NSString *identifier = [NSString stringWithFormat:@"%p", self];
    [MQTTService.shared addObserverWithIdentifier:identifier callback:^(NSString *eventName, id body) {
        dispatch_async(dispatch_get_main_queue(), ^{
            if (weakSelf) {
                 id finalBody = body ? body : [NSNull null];
                 [weakSelf sendEventWithName:eventName body:finalBody];
            }
        });
    }];
  }
  return self;
}

// Fix for "RCTCallableJSModules is not set" assertion crash in New Architecture
- (void)sendEventWithName:(NSString *)eventName body:(id)body {
  if (self.callableJSModules) {
    [super sendEventWithName:eventName body:body];
  } else {
    RCTLogWarn(@"[RCTMQTT] Warning: sendEventWithName called before callableJSModules was set. Dropping event: %@", eventName);
  }
}

- (void)invalidate {
  NSString *identifier = [NSString stringWithFormat:@"%p", self];
  [MQTTService.shared removeObserverWithIdentifier:identifier];
  [super invalidate];
}

- (void)dealloc {
  NSString *identifier = [NSString stringWithFormat:@"%p", self];
  [MQTTService.shared removeObserverWithIdentifier:identifier];
}

- (std::shared_ptr<TurboModule>)getTurboModule:
(const ObjCTurboModule::InitParams &)params
{
  return std::make_shared<NativeMQTTSpecJSI>(params);
}

- (NSArray<NSString *> *)supportedEvents {
  return @[
    @"onConnect",
    @"onConnectFailure",
    @"onConnectionLost",
    @"onDisconnect",
    @"onReconnect",
    @"onMessageReceived",
    @"onPublishSuccess",
    @"onSubscribeSuccess",
    @"onUnsubscribeSuccess",
    @"onDeliveryComplete",
    @"onDestroy",
    @"onError"
  ];
}

#pragma mark - Event Emitter Stubs

- (void)addListener:(NSString *)eventType {
    [super addListener:eventType];
    RCTLogInfo(@"[RCTMQTT] addListener called for: %@", eventType);
}

- (void)removeListeners:(double)count {
    [super removeListeners:count];
    RCTLogInfo(@"[RCTMQTT] removeListeners called with count: %f", count);
}

#pragma mark - Lifecycle

- (void)initialize:(JS::NativeMQTT::MQTTConfig &)config
        sslConfig:(JS::NativeMQTT::MQTTSSLConfig &)sslConfig
       willConfig:(JS::NativeMQTT::MQTTWillConfig &)willConfig
          resolve:(RCTPromiseResolveBlock)resolve
           reject:(RCTPromiseRejectBlock)reject
{
  // Since generated JSI structs use NSString* for strings, use them directly
  NSString *host = config.host();
  int port = (int)config.port();
  NSString *clientId = config.clientId();
  NSString *protocol = config.protocol();
  NSString *username = config.username();
  NSString *password = config.password();

  int keepAlive = 60;
  if (config.keepAlive().has_value()) {
      keepAlive = (int)config.keepAlive().value();
  }
  
  BOOL useSSL = [protocol isEqualToString:@"wss"] || [protocol isEqualToString:@"ssl"];
  
  RCTLogInfo(@"[RCTMQTT] Initializing with host: %@, port: %d, useSSL: %d", host, port, useSSL);

  if ([protocol isEqualToString:@"mqtt5"] || [protocol isEqualToString:@"wss5"]) {
      [MQTTService.shared connectMQTT5WithHost:host
                                          port:port
                                      clientId:clientId
                                      protocol:protocol
                                        useSSL:useSSL
                                      username:username
                                      password:password
                                     keepAlive:keepAlive];
  } else {
      [MQTTService.shared connectMQTT311WithHost:host
                                            port:port
                                        clientId:clientId
                                        protocol:protocol
                                          useSSL:useSSL
                                        username:username
                                        password:password
                                       keepAlive:keepAlive];
  }

  if (resolve) {
    resolve(@(YES));
  }
}

- (void)destroy:(RCTPromiseResolveBlock)resolve
         reject:(RCTPromiseRejectBlock)reject
{
  [MQTTService.shared disconnect];
  if (resolve) {
    resolve(@(YES));
  }
}

#pragma mark - Connection

- (void)connect:(RCTPromiseResolveBlock)resolve
         reject:(RCTPromiseRejectBlock)reject
{
  // Connection is handled in initialize for now
  if (resolve) {
    resolve(@(YES));
  }
}

- (void)disconnect:(RCTPromiseResolveBlock)resolve
            reject:(RCTPromiseRejectBlock)reject
{
  [MQTTService.shared disconnect];
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
  BOOL connected = [MQTTService.shared isConnected];
  if (resolve) {
    resolve(@(connected));
  }
}

- (void)getConnectionStatus:(RCTPromiseResolveBlock)resolve
                     reject:(RCTPromiseRejectBlock)reject
{
  BOOL connected = [MQTTService.shared isConnected];
  if (resolve) {
     resolve(connected ? @"connected" : @"disconnected");
  }
}

#pragma mark - Messaging

- (void)publish:(nonnull NSString *)topic
          message:(nonnull NSString *)message
          options:(JS::NativeMQTT::MQTTPublishOptions &)options
          resolve:(RCTPromiseResolveBlock)resolve
           reject:(RCTPromiseRejectBlock)reject
{
    int qosVal = 0;
    if (options.qos().has_value()) {
        qosVal = (int)options.qos().value();
    }
    
    BOOL retainedVal = NO;
    if (options.retained().has_value()) {
        retainedVal = options.retained().value();
    }
    
    [MQTTService.shared publishWithTopic:topic message:message qos:qosVal retained:retainedVal];
    
    if (resolve) {
        resolve(@(YES));
    }
}

- (void)subscribe:(nonnull NSString *)topic
           options:(JS::NativeMQTT::MQTTSubscribeOptions &)options
           resolve:(RCTPromiseResolveBlock)resolve
            reject:(RCTPromiseRejectBlock)reject
{
    int qosVal = 0;
    if (options.qos().has_value()) {
        qosVal = (int)options.qos().value();
    }
    
    [MQTTService.shared subscribeWithTopic:topic qos:qosVal];
    
    if (resolve) {
        resolve(@(YES));
    }
}

- (void)unsubscribe:(nonnull NSString *)topic
             resolve:(RCTPromiseResolveBlock)resolve
              reject:(RCTPromiseRejectBlock)reject
{
    [MQTTService.shared unsubscribeWithTopic:topic];
    if (resolve) {
        resolve(@(YES));
    }
}

@end
