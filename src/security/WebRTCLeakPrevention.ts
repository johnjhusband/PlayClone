import { Page, BrowserContext } from 'playwright';
import { Logger } from '../utils/Logger';

interface WebRTCConfig {
  disableWebRTC?: boolean;
  preventIPLeak?: boolean;
  useSTUNServers?: boolean;
  useTURNServers?: boolean;
  customICEServers?: RTCIceServer[];
  blockLocalIPs?: boolean;
  blockPublicIPs?: boolean;
  forceProxy?: boolean;
  spoofLocalIP?: string;
  spoofPublicIP?: string;
}

interface RTCIceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

interface IPInfo {
  localIPs: string[];
  publicIPs: string[];
  isLeaking: boolean;
  webRTCEnabled: boolean;
}

export class WebRTCLeakPrevention {
  private logger: Logger;
  private activeConfigs: Map<string, WebRTCConfig> = new Map();
  private detectedIPs: Map<string, IPInfo> = new Map();

  constructor() {
    this.logger = new Logger('WebRTCLeakPrevention');
  }

  public async applyWebRTCProtection(
    page: Page,
    config: WebRTCConfig = { preventIPLeak: true }
  ): Promise<void> {
    const pageUrl = page.url();
    this.activeConfigs.set(pageUrl, config);

    try {
      if (config.disableWebRTC) {
        await this.disableWebRTC(page);
      } else if (config.preventIPLeak) {
        await this.preventIPLeak(page, config);
      }

      // Monitor for IP leaks
      await this.setupLeakMonitoring(page);

      this.logger.info('Applied WebRTC protection', {
        url: pageUrl,
        disableWebRTC: config.disableWebRTC,
        preventIPLeak: config.preventIPLeak,
        blockLocalIPs: config.blockLocalIPs,
        blockPublicIPs: config.blockPublicIPs
      });

    } catch (error) {
      this.logger.error('Failed to apply WebRTC protection', error);
      throw error;
    }
  }

  private async disableWebRTC(page: Page): Promise<void> {
    await page.addInitScript(() => {
      // Completely disable WebRTC
      const noop = () => {};
      const unavailable = () => { 
        throw new Error('WebRTC is not supported'); 
      };

      // Override RTCPeerConnection
      (window as any).RTCPeerConnection = undefined;
      (window as any).webkitRTCPeerConnection = undefined;
      (window as any).mozRTCPeerConnection = undefined;

      // Override getUserMedia
      if (navigator.mediaDevices) {
        navigator.mediaDevices.getUserMedia = unavailable;
      }
      (navigator as any).getUserMedia = undefined;
      (navigator as any).webkitGetUserMedia = undefined;
      (navigator as any).mozGetUserMedia = undefined;

      // Override RTCDataChannel
      (window as any).RTCDataChannel = undefined;

      // Override RTCSessionDescription
      (window as any).RTCSessionDescription = undefined;
      (window as any).webkitRTCSessionDescription = undefined;
      (window as any).mozRTCSessionDescription = undefined;

      // Override RTCIceCandidate
      (window as any).RTCIceCandidate = undefined;
      (window as any).webkitRTCIceCandidate = undefined;
      (window as any).mozRTCIceCandidate = undefined;
    });
  }

  private async preventIPLeak(page: Page, config: WebRTCConfig): Promise<void> {
    await page.addInitScript((conf) => {
      const originalRTCPeerConnection = window.RTCPeerConnection || 
                                       (window as any).webkitRTCPeerConnection ||
                                       (window as any).mozRTCPeerConnection;

      if (!originalRTCPeerConnection) return;

      // Create wrapper for RTCPeerConnection
      const RTCPeerConnectionWrapper = function(
        configuration?: RTCConfiguration,
        constraints?: any
      ) {
        // Modify ICE servers if needed
        if (configuration) {
          if (conf.customICEServers) {
            configuration.iceServers = conf.customICEServers;
          } else if (!conf.useSTUNServers && !conf.useTURNServers) {
            // Remove all ICE servers to prevent IP discovery
            configuration.iceServers = [];
          } else {
            // Filter ICE servers based on config
            if (configuration.iceServers) {
              configuration.iceServers = configuration.iceServers.filter((server: any) => {
                const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
                return urls.every((url: string) => {
                  if (!conf.useSTUNServers && url.startsWith('stun:')) return false;
                  if (!conf.useTURNServers && url.startsWith('turn:')) return false;
                  return true;
                });
              });
            }
          }

          // Force specific ICE transport policy
          if (conf.forceProxy) {
            configuration.iceTransportPolicy = 'relay';
          }
        }

        const pc = new originalRTCPeerConnection(configuration);
        
        // Override createDataChannel to monitor channel creation
        const originalCreateDataChannel = pc.createDataChannel;
        pc.createDataChannel = function(label: string, options?: RTCDataChannelInit) {
          console.log('WebRTC DataChannel creation intercepted:', label);
          return originalCreateDataChannel.apply(this, [label, options]);
        };

        // Override createOffer to modify SDP
        const originalCreateOffer = pc.createOffer.bind(pc);
        (pc as any).createOffer = async function(...args: any[]) {
          const offer = await originalCreateOffer(...args);
          
          if (offer && offer.sdp) {
            offer.sdp = modifySDP(offer.sdp, conf);
          }
          
          return offer;
        };

        // Override createAnswer to modify SDP
        const originalCreateAnswer = pc.createAnswer.bind(pc);
        (pc as any).createAnswer = async function(...args: any[]) {
          const answer = await originalCreateAnswer(...args);
          
          if (answer && answer.sdp) {
            answer.sdp = modifySDP(answer.sdp, conf);
          }
          
          return answer;
        };

        // Override setLocalDescription to filter candidates
        const originalSetLocalDescription = pc.setLocalDescription.bind(pc);
        (pc as any).setLocalDescription = function(...args: any[]) {
          if (args[0] && args[0].sdp) {
            args[0].sdp = modifySDP(args[0].sdp, conf);
          }
          return originalSetLocalDescription(...args);
        };

        // Override addIceCandidate to filter candidates
        const originalAddIceCandidate = pc.addIceCandidate.bind(pc);
        (pc as any).addIceCandidate = function(...args: any[]) {
          const candidate = args[0];
          if (candidate && typeof candidate === 'object' && 'candidate' in candidate) {
            const candidateStr = candidate.candidate;
            
            if (candidateStr && shouldBlockCandidate(candidateStr, conf)) {
              console.log('Blocked ICE candidate:', candidateStr);
              return Promise.resolve();
            }
          }
          
          return originalAddIceCandidate(...args);
        };

        // Monitor onicecandidate events
        let originalOnIceCandidate: ((this: RTCPeerConnection, ev: RTCPeerConnectionIceEvent) => any) | null = null;
        Object.defineProperty(pc, 'onicecandidate', {
          get: () => originalOnIceCandidate,
          set: (handler) => {
            originalOnIceCandidate = handler ? function(event: RTCPeerConnectionIceEvent) {
              if (event.candidate) {
                const candidateStr = event.candidate.candidate;
                
                if (shouldBlockCandidate(candidateStr, conf)) {
                  console.log('Filtered ICE candidate:', candidateStr);
                  // Create modified event without the candidate
                  const modifiedEvent = new Event('icecandidate') as RTCPeerConnectionIceEvent;
                  Object.defineProperty(modifiedEvent, 'candidate', {
                    value: null,
                    writable: false
                  });
                  return handler.call(this, modifiedEvent);
                }
              }
              
              return handler.call(this, event);
            } : null;
          }
        });

        return pc;
      };

      // Helper function to modify SDP
      function modifySDP(sdp: string, config: any): string {
        let modifiedSDP = sdp;

        // Remove or replace IP addresses
        if (config.blockLocalIPs) {
          // Replace local IPs with fake ones
          modifiedSDP = modifiedSDP.replace(
            /(\d{1,3}\.){3}\d{1,3}/g,
            (match) => {
              if (isPrivateIP(match)) {
                return config.spoofLocalIP || '10.0.0.1';
              }
              return match;
            }
          );
        }

        if (config.blockPublicIPs) {
          // Replace public IPs with fake ones
          modifiedSDP = modifiedSDP.replace(
            /(\d{1,3}\.){3}\d{1,3}/g,
            (match) => {
              if (!isPrivateIP(match)) {
                return config.spoofPublicIP || '1.1.1.1';
              }
              return match;
            }
          );
        }

        // Remove IPv6 addresses if needed
        if (config.blockLocalIPs || config.blockPublicIPs) {
          modifiedSDP = modifiedSDP.replace(
            /[a-f0-9]{1,4}(:[a-f0-9]{1,4}){7}/gi,
            '::1'
          );
        }

        return modifiedSDP;
      }

      // Helper function to check if IP is private
      function isPrivateIP(ip: string): boolean {
        const parts = ip.split('.').map(Number);
        return (
          parts[0] === 10 ||
          (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
          (parts[0] === 192 && parts[1] === 168) ||
          parts[0] === 127
        );
      }

      // Helper function to determine if candidate should be blocked
      function shouldBlockCandidate(candidate: string, config: any): boolean {
        // Extract IP from candidate
        const ipMatch = candidate.match(/(\d{1,3}\.){3}\d{1,3}/);
        if (!ipMatch) return false;

        const ip = ipMatch[0];
        
        if (config.blockLocalIPs && isPrivateIP(ip)) {
          return true;
        }
        
        if (config.blockPublicIPs && !isPrivateIP(ip)) {
          return true;
        }

        // Block based on candidate type
        if (candidate.includes('typ host') && config.blockLocalIPs) {
          return true;
        }
        
        if (candidate.includes('typ srflx') && config.blockPublicIPs) {
          return true;
        }

        return false;
      }

      // Copy static methods and properties
      RTCPeerConnectionWrapper.prototype = originalRTCPeerConnection.prototype;
      for (const key in originalRTCPeerConnection) {
        if (originalRTCPeerConnection.hasOwnProperty(key)) {
          (RTCPeerConnectionWrapper as any)[key] = (originalRTCPeerConnection as any)[key];
        }
      }

      // Replace global RTCPeerConnection
      window.RTCPeerConnection = RTCPeerConnectionWrapper as any;
      (window as any).webkitRTCPeerConnection = RTCPeerConnectionWrapper;
      (window as any).mozRTCPeerConnection = RTCPeerConnectionWrapper;

    }, config);
  }

  private async setupLeakMonitoring(page: Page): Promise<void> {
    // Inject IP leak detection script
    await page.addInitScript(() => {
      (window as any).__webrtc_ips = {
        local: new Set<string>(),
        public: new Set<string>()
      };

      // Monitor for IP leaks through WebRTC
      const originalRTCPeerConnection = window.RTCPeerConnection || 
                                       (window as any).webkitRTCPeerConnection ||
                                       (window as any).mozRTCPeerConnection;

      if (originalRTCPeerConnection) {
        const originalCreateOffer = originalRTCPeerConnection.prototype.createOffer;
        (originalRTCPeerConnection.prototype as any).createOffer = function(...args: any[]) {
          // Call original and handle both Promise and callback patterns
          const result = originalCreateOffer.apply(this, args as any);
          
          // If it returns a promise, intercept it
          if (result && typeof result.then === 'function') {
            return result.then((offer: any) => {
              // Extract IPs from SDP
              if (offer && offer.sdp) {
                const ips = extractIPsFromSDP(offer.sdp);
                ips.local.forEach(ip => (window as any).__webrtc_ips.local.add(ip));
                ips.public.forEach(ip => (window as any).__webrtc_ips.public.add(ip));
              }
              return offer;
            });
          }
          
          return result;
        };
      }

      function extractIPsFromSDP(sdp: string): { local: string[], public: string[] } {
        const local: string[] = [];
        const public_: string[] = [];
        
        const ipRegex = /(\d{1,3}\.){3}\d{1,3}/g;
        const matches = sdp.match(ipRegex) || [];
        
        matches.forEach(ip => {
          if (isPrivateIP(ip)) {
            local.push(ip);
          } else if (ip !== '0.0.0.0' && ip !== '255.255.255.255') {
            public_.push(ip);
          }
        });
        
        return { local, public: public_ };
      }

      function isPrivateIP(ip: string): boolean {
        const parts = ip.split('.').map(Number);
        return (
          parts[0] === 10 ||
          (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
          (parts[0] === 192 && parts[1] === 168) ||
          parts[0] === 127
        );
      }
    });
  }

  public async detectIPLeak(page: Page): Promise<IPInfo> {
    const detectedIPs = await page.evaluate(() => {
      const ips = (window as any).__webrtc_ips || { local: new Set(), public: new Set() };
      return {
        localIPs: Array.from(ips.local),
        publicIPs: Array.from(ips.public),
        webRTCEnabled: typeof RTCPeerConnection !== 'undefined'
      };
    });

    const ipInfo: IPInfo = {
      localIPs: detectedIPs.localIPs as string[],
      publicIPs: detectedIPs.publicIPs as string[],
      webRTCEnabled: detectedIPs.webRTCEnabled,
      isLeaking: detectedIPs.localIPs.length > 0 || detectedIPs.publicIPs.length > 0
    };

    const pageUrl = page.url();
    this.detectedIPs.set(pageUrl, ipInfo);

    if (ipInfo.isLeaking) {
      this.logger.warn('WebRTC IP leak detected', {
        url: pageUrl,
        localIPs: ipInfo.localIPs,
        publicIPs: ipInfo.publicIPs
      });
    }

    return ipInfo;
  }

  public async applyToContext(
    context: BrowserContext,
    config: WebRTCConfig = { preventIPLeak: true }
  ): Promise<void> {
    // Apply to all new pages in context
    context.on('page', async (page) => {
      await this.applyWebRTCProtection(page, config);
    });

    // Apply to existing pages
    const pages = context.pages();
    for (const page of pages) {
      await this.applyWebRTCProtection(page, config);
    }

    this.logger.info('Applied WebRTC protection to browser context');
  }

  public async testWebRTCLeak(page: Page): Promise<{
    isProtected: boolean;
    localIPsExposed: string[];
    publicIPsExposed: string[];
    webRTCStatus: string;
  }> {
    // Test WebRTC leak using a simple peer connection
    const result = await page.evaluate(async () => {
      const ips = {
        local: new Set<string>(),
        public: new Set<string>()
      };

      try {
        const pc = new RTCPeerConnection({
          iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
        });

        pc.onicecandidate = (event) => {
          if (event.candidate) {
            const candidate = event.candidate.candidate;
            const ipMatch = candidate.match(/(\d{1,3}\.){3}\d{1,3}/);
            
            if (ipMatch) {
              const ip = ipMatch[0];
              const parts = ip.split('.').map(Number);
              
              if (parts[0] === 10 ||
                  (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
                  (parts[0] === 192 && parts[1] === 168) ||
                  parts[0] === 127) {
                ips.local.add(ip);
              } else if (ip !== '0.0.0.0' && ip !== '255.255.255.255') {
                ips.public.add(ip);
              }
            }
          }
        };

        // Create dummy data channel
        pc.createDataChannel('test');

        // Create offer
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        // Wait for ICE gathering
        await new Promise(resolve => setTimeout(resolve, 2000));

        pc.close();

        return {
          localIPs: Array.from(ips.local),
          publicIPs: Array.from(ips.public),
          webRTCEnabled: true
        };

      } catch (error) {
        return {
          localIPs: [],
          publicIPs: [],
          webRTCEnabled: false
        };
      }
    });

    const isProtected = result.localIPs.length === 0 && result.publicIPs.length === 0;
    const webRTCStatus = !result.webRTCEnabled ? 'disabled' : 
                        isProtected ? 'protected' : 'leaking';

    return {
      isProtected,
      localIPsExposed: result.localIPs,
      publicIPsExposed: result.publicIPs,
      webRTCStatus
    };
  }

  public getDetectedIPs(pageUrl: string): IPInfo | undefined {
    return this.detectedIPs.get(pageUrl);
  }

  public clearDetectedIPs(): void {
    this.detectedIPs.clear();
    this.logger.info('Cleared detected IP addresses');
  }
}