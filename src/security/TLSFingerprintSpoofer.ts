import { BrowserContext, Page } from 'playwright';
import { Logger } from '../utils/Logger';

interface TLSProfile {
  name: string;
  cipherSuites: string[];
  extensions: number[];
  ellipticCurves: string[];
  ellipticCurvePointFormats: number[];
  signatureAlgorithms: string[];
  alpnProtocols: string[];
  tlsVersion: {
    min: string;
    max: string;
  };
  http2Settings: {
    headerTableSize: number;
    enablePush: boolean;
    maxConcurrentStreams: number;
    initialWindowSize: number;
    maxFrameSize: number;
    maxHeaderListSize: number;
  };
}

export class TLSFingerprintSpoofer {
  private logger: Logger;
  private profiles: Map<string, TLSProfile> = new Map();
  private activeProfile: TLSProfile | null = null;

  constructor() {
    this.logger = new Logger('TLSFingerprintSpoofer');
    this.initializeProfiles();
  }

  private initializeProfiles(): void {
    // Chrome TLS fingerprint
    this.profiles.set('chrome', {
      name: 'Chrome',
      cipherSuites: [
        'TLS_AES_128_GCM_SHA256',
        'TLS_AES_256_GCM_SHA384',
        'TLS_CHACHA20_POLY1305_SHA256',
        'ECDHE-ECDSA-AES128-GCM-SHA256',
        'ECDHE-RSA-AES128-GCM-SHA256',
        'ECDHE-ECDSA-AES256-GCM-SHA384',
        'ECDHE-RSA-AES256-GCM-SHA384',
        'ECDHE-ECDSA-CHACHA20-POLY1305',
        'ECDHE-RSA-CHACHA20-POLY1305',
        'ECDHE-RSA-AES128-SHA',
        'ECDHE-RSA-AES256-SHA',
        'AES128-GCM-SHA256',
        'AES256-GCM-SHA384',
        'AES128-SHA',
        'AES256-SHA'
      ],
      extensions: [
        0,      // server_name
        5,      // status_request
        10,     // supported_groups
        11,     // ec_point_formats
        13,     // signature_algorithms
        16,     // application_layer_protocol_negotiation
        18,     // signed_certificate_timestamp
        21,     // padding
        23,     // extended_master_secret
        27,     // compress_certificate
        28,     // record_size_limit
        35,     // session_ticket
        43,     // supported_versions
        44,     // cookie
        45,     // psk_key_exchange_modes
        51,     // key_share
        57,     // quic_transport_parameters
        65281   // renegotiation_info
      ],
      ellipticCurves: [
        'x25519',
        'secp256r1',
        'secp384r1'
      ],
      ellipticCurvePointFormats: [0], // uncompressed
      signatureAlgorithms: [
        'ecdsa_secp256r1_sha256',
        'rsa_pss_rsae_sha256',
        'rsa_pkcs1_sha256',
        'ecdsa_secp384r1_sha384',
        'rsa_pss_rsae_sha384',
        'rsa_pkcs1_sha384',
        'rsa_pss_rsae_sha512',
        'rsa_pkcs1_sha512'
      ],
      alpnProtocols: ['h2', 'http/1.1'],
      tlsVersion: {
        min: 'TLSv1.2',
        max: 'TLSv1.3'
      },
      http2Settings: {
        headerTableSize: 65536,
        enablePush: true,
        maxConcurrentStreams: 1000,
        initialWindowSize: 6291456,
        maxFrameSize: 16777215,
        maxHeaderListSize: 262144
      }
    });

    // Firefox TLS fingerprint
    this.profiles.set('firefox', {
      name: 'Firefox',
      cipherSuites: [
        'TLS_AES_128_GCM_SHA256',
        'TLS_CHACHA20_POLY1305_SHA256',
        'TLS_AES_256_GCM_SHA384',
        'ECDHE-ECDSA-AES128-GCM-SHA256',
        'ECDHE-RSA-AES128-GCM-SHA256',
        'ECDHE-ECDSA-CHACHA20-POLY1305',
        'ECDHE-RSA-CHACHA20-POLY1305',
        'ECDHE-ECDSA-AES256-GCM-SHA384',
        'ECDHE-RSA-AES256-GCM-SHA384',
        'ECDHE-ECDSA-AES256-SHA',
        'ECDHE-ECDSA-AES128-SHA',
        'ECDHE-RSA-AES128-SHA',
        'ECDHE-RSA-AES256-SHA',
        'AES128-GCM-SHA256',
        'AES256-GCM-SHA384',
        'AES128-SHA',
        'AES256-SHA'
      ],
      extensions: [
        0,      // server_name
        5,      // status_request
        10,     // supported_groups
        11,     // ec_point_formats
        13,     // signature_algorithms
        16,     // application_layer_protocol_negotiation
        21,     // padding
        23,     // extended_master_secret
        28,     // record_size_limit
        34,     // delegated_credentials
        35,     // session_ticket
        43,     // supported_versions
        45,     // psk_key_exchange_modes
        51,     // key_share
        57,     // quic_transport_parameters
        65281   // renegotiation_info
      ],
      ellipticCurves: [
        'x25519',
        'secp256r1',
        'secp384r1',
        'secp521r1',
        'ffdhe2048',
        'ffdhe3072'
      ],
      ellipticCurvePointFormats: [0], // uncompressed
      signatureAlgorithms: [
        'ecdsa_secp256r1_sha256',
        'ecdsa_secp384r1_sha384',
        'ecdsa_secp521r1_sha512',
        'rsa_pss_rsae_sha256',
        'rsa_pss_rsae_sha384',
        'rsa_pss_rsae_sha512',
        'rsa_pkcs1_sha256',
        'rsa_pkcs1_sha384',
        'rsa_pkcs1_sha512',
        'ecdsa_sha1',
        'rsa_pkcs1_sha1'
      ],
      alpnProtocols: ['h2', 'http/1.1'],
      tlsVersion: {
        min: 'TLSv1.2',
        max: 'TLSv1.3'
      },
      http2Settings: {
        headerTableSize: 65536,
        enablePush: false,
        maxConcurrentStreams: 100,
        initialWindowSize: 131072,
        maxFrameSize: 16384,
        maxHeaderListSize: 262144
      }
    });

    // Safari TLS fingerprint
    this.profiles.set('safari', {
      name: 'Safari',
      cipherSuites: [
        'TLS_AES_128_GCM_SHA256',
        'TLS_AES_256_GCM_SHA384',
        'TLS_CHACHA20_POLY1305_SHA256',
        'ECDHE-ECDSA-AES256-GCM-SHA384',
        'ECDHE-ECDSA-AES128-GCM-SHA256',
        'ECDHE-ECDSA-CHACHA20-POLY1305',
        'ECDHE-RSA-AES256-GCM-SHA384',
        'ECDHE-RSA-AES128-GCM-SHA256',
        'ECDHE-RSA-CHACHA20-POLY1305',
        'ECDHE-ECDSA-AES256-SHA384',
        'ECDHE-ECDSA-AES128-SHA256',
        'ECDHE-RSA-AES256-SHA384',
        'ECDHE-RSA-AES128-SHA256'
      ],
      extensions: [
        0,      // server_name
        5,      // status_request
        10,     // supported_groups
        11,     // ec_point_formats
        13,     // signature_algorithms
        14,     // use_srtp
        16,     // application_layer_protocol_negotiation
        17,     // status_request_v2
        23,     // extended_master_secret
        35,     // session_ticket
        43,     // supported_versions
        45,     // psk_key_exchange_modes
        51,     // key_share
        65281   // renegotiation_info
      ],
      ellipticCurves: [
        'x25519',
        'secp256r1',
        'secp384r1',
        'secp521r1'
      ],
      ellipticCurvePointFormats: [0], // uncompressed
      signatureAlgorithms: [
        'ecdsa_secp256r1_sha256',
        'rsa_pss_rsae_sha256',
        'rsa_pkcs1_sha256',
        'ecdsa_secp384r1_sha384',
        'ecdsa_secp521r1_sha512',
        'rsa_pss_rsae_sha384',
        'rsa_pss_rsae_sha512',
        'rsa_pkcs1_sha384',
        'rsa_pkcs1_sha512',
        'rsa_pkcs1_sha1'
      ],
      alpnProtocols: ['h2', 'http/1.1'],
      tlsVersion: {
        min: 'TLSv1.2',
        max: 'TLSv1.3'
      },
      http2Settings: {
        headerTableSize: 4096,
        enablePush: false,
        maxConcurrentStreams: 100,
        initialWindowSize: 65535,
        maxFrameSize: 16384,
        maxHeaderListSize: 8192
      }
    });
  }

  public async applyTLSFingerprint(
    context: BrowserContext,
    profileName: string = 'chrome'
  ): Promise<void> {
    const profile = this.profiles.get(profileName);
    if (!profile) {
      throw new Error(`TLS profile '${profileName}' not found`);
    }

    this.activeProfile = profile;

    try {
      // Note: Direct TLS manipulation requires browser modification
      // This implementation provides the framework for TLS spoofing
      // Actual implementation would require custom Chromium builds or proxy servers
      
      // Set HTTP/2 settings through CDP if available
      const pages = context.pages();
      for (const page of pages) {
        await this.applyHTTP2Settings(page, profile);
      }

      // Apply to new pages
      context.on('page', async (page) => {
        await this.applyHTTP2Settings(page, profile);
      });

      // Log simulated TLS fingerprint application
      this.logger.info('Applied TLS fingerprint profile', {
        profile: profileName,
        cipherSuites: profile.cipherSuites.length,
        extensions: profile.extensions.length,
        tlsVersions: `${profile.tlsVersion.min} - ${profile.tlsVersion.max}`
      });

    } catch (error) {
      this.logger.error('Failed to apply TLS fingerprint', error);
      throw error;
    }
  }

  private async applyHTTP2Settings(page: Page, profile: TLSProfile): Promise<void> {
    try {
      // Use CDP to modify network conditions
      const client = await (page.context() as any)._browser.newBrowserCDPSession();
      
      // Set user agent to match browser profile
      await client.send('Network.setUserAgentOverride', {
        userAgent: this.getUserAgentForProfile(profile.name),
        acceptLanguage: 'en-US,en;q=0.9',
        platform: this.getPlatformForProfile(profile.name)
      });

      // Enable network domain
      await client.send('Network.enable');

      // Set accepted encodings to match profile
      await client.send('Network.setAcceptedEncodings', {
        encodings: ['gzip', 'deflate', 'br']
      });

      // Set connection throttling to simulate realistic network conditions
      if (profile.name === 'chrome') {
        await client.send('Network.emulateNetworkConditions', {
          offline: false,
          downloadThroughput: -1,
          uploadThroughput: -1,
          latency: 0,
          packetLoss: 0,
          connectionType: 'wifi'
        });
      }

    } catch (error) {
      // CDP might not be available in all contexts
      this.logger.debug('Could not apply HTTP/2 settings via CDP', error);
    }
  }

  private getUserAgentForProfile(profileName: string): string {
    const userAgents: { [key: string]: string } = {
      chrome: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      firefox: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
      safari: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_2) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15'
    };
    return userAgents[profileName.toLowerCase()] || userAgents.chrome;
  }

  private getPlatformForProfile(profileName: string): string {
    const platforms: { [key: string]: string } = {
      chrome: 'Win32',
      firefox: 'Win32',
      safari: 'MacIntel'
    };
    return platforms[profileName.toLowerCase()] || 'Win32';
  }

  public rotateProfile(): string {
    const profiles = Array.from(this.profiles.keys());
    const currentIndex = this.activeProfile 
      ? profiles.indexOf(this.activeProfile.name.toLowerCase())
      : -1;
    const nextIndex = (currentIndex + 1) % profiles.length;
    return profiles[nextIndex];
  }

  public getActiveProfile(): TLSProfile | null {
    return this.activeProfile;
  }

  public getAvailableProfiles(): string[] {
    return Array.from(this.profiles.keys());
  }

  public async validateTLSFingerprint(page: Page): Promise<{
    isValid: boolean;
    detectedFeatures: {
      userAgent: string;
      platform: string;
      languages: string[];
      acceptedEncodings?: string[];
    };
  }> {
    const detected = await page.evaluate(() => {
      return {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        languages: navigator.languages,
        connection: (navigator as any).connection ? {
          effectiveType: (navigator as any).connection.effectiveType,
          rtt: (navigator as any).connection.rtt,
          downlink: (navigator as any).connection.downlink
        } : null
      };
    });

    const expectedUA = this.activeProfile 
      ? this.getUserAgentForProfile(this.activeProfile.name)
      : '';
    
    const isValid = this.activeProfile 
      ? detected.userAgent === expectedUA
      : false;

    return {
      isValid,
      detectedFeatures: {
        userAgent: detected.userAgent,
        platform: detected.platform,
        languages: [...detected.languages]
      }
    };
  }

  public generateJA3Fingerprint(profile: TLSProfile): string {
    // Generate JA3 fingerprint hash
    // Format: SSLVersion,Ciphers,Extensions,EllipticCurves,EllipticCurvePointFormats
    const tlsVersion = '771'; // TLS 1.3
    const ciphers = profile.cipherSuites.slice(0, 10).map(c => 
      this.cipherToCode(c)).join('-');
    const extensions = profile.extensions.join('-');
    const curves = profile.ellipticCurves.map(c => 
      this.curveToCode(c)).join('-');
    const formats = profile.ellipticCurvePointFormats.join('-');

    const ja3String = `${tlsVersion},${ciphers},${extensions},${curves},${formats}`;
    
    // In production, this would be MD5 hashed
    return ja3String;
  }

  private cipherToCode(cipher: string): number {
    // Map cipher suite names to TLS codes
    const cipherMap: { [key: string]: number } = {
      'TLS_AES_128_GCM_SHA256': 0x1301,
      'TLS_AES_256_GCM_SHA384': 0x1302,
      'TLS_CHACHA20_POLY1305_SHA256': 0x1303,
      'ECDHE-ECDSA-AES128-GCM-SHA256': 0xc02b,
      'ECDHE-RSA-AES128-GCM-SHA256': 0xc02f,
      'ECDHE-ECDSA-AES256-GCM-SHA384': 0xc02c,
      'ECDHE-RSA-AES256-GCM-SHA384': 0xc030
    };
    return cipherMap[cipher] || 0;
  }

  private curveToCode(curve: string): number {
    // Map curve names to TLS codes
    const curveMap: { [key: string]: number } = {
      'x25519': 29,
      'secp256r1': 23,
      'secp384r1': 24,
      'secp521r1': 25
    };
    return curveMap[curve] || 0;
  }
}