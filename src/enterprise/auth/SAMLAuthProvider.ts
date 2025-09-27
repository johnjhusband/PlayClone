import { EventEmitter } from 'events';
import * as crypto from 'crypto';
import { Logger } from '../../utils/Logger';

export interface SAMLConfig {
  entityId: string;
  ssoUrl: string;
  sloUrl?: string;
  certificate: string;
  privateKey?: string;
  callbackUrl: string;
  issuer: string;
  audience?: string;
  signatureAlgorithm?: 'sha1' | 'sha256' | 'sha512';
  digestAlgorithm?: 'sha1' | 'sha256' | 'sha512';
  requestIdExpirationPeriod?: number;
  maxSessionAge?: number;
  nameIdFormat?: string;
  attributeMapping?: {
    id?: string;
    email?: string;
    name?: string;
    firstName?: string;
    lastName?: string;
    groups?: string;
    roles?: string;
  };
}

export interface SAMLAssertion {
  nameId: string;
  nameIdFormat?: string;
  sessionIndex?: string;
  attributes: Record<string, any>;
  conditions?: {
    notBefore?: Date;
    notOnOrAfter?: Date;
    audience?: string[];
  };
}

export interface SAMLUser {
  id: string;
  email?: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  groups?: string[];
  roles?: string[];
  attributes?: Record<string, any>;
  sessionIndex?: string;
  nameId?: string;
}

export class SAMLAuthProvider extends EventEmitter {
  private config: SAMLConfig;
  private logger: Logger;
  private requestCache: Map<string, { timestamp: number; returnUrl?: string }> = new Map();
  private sessionCache: Map<string, SAMLUser> = new Map();

  constructor(config: SAMLConfig) {
    super();
    this.config = {
      signatureAlgorithm: 'sha256',
      digestAlgorithm: 'sha256',
      requestIdExpirationPeriod: 300000, // 5 minutes
      maxSessionAge: 86400000, // 24 hours
      nameIdFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
      ...config
    };
    this.logger = Logger.getInstance();
    this.logger.info('SAML Auth Provider initialized', { entityId: config.entityId });

    // Clean up expired requests periodically
    setInterval(() => this.cleanupExpiredRequests(), 60000); // Every minute
  }

  /**
   * Generate SAML authentication request
   */
  public generateAuthRequest(returnUrl?: string): { requestId: string; url: string; samlRequest: string } {
    const requestId = `_${crypto.randomBytes(16).toString('hex')}`;
    const timestamp = new Date().toISOString();
    
    const samlRequest = `
      <samlp:AuthnRequest 
        xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" 
        xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"
        ID="${requestId}"
        Version="2.0"
        IssueInstant="${timestamp}"
        Destination="${this.config.ssoUrl}"
        AssertionConsumerServiceURL="${this.config.callbackUrl}"
        ProtocolBinding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST">
        <saml:Issuer>${this.config.issuer}</saml:Issuer>
        <samlp:NameIDPolicy 
          Format="${this.config.nameIdFormat}"
          AllowCreate="true" />
        <samlp:RequestedAuthnContext Comparison="exact">
          <saml:AuthnContextClassRef>urn:oasis:names:tc:SAML:2.0:ac:classes:PasswordProtectedTransport</saml:AuthnContextClassRef>
        </samlp:RequestedAuthnContext>
      </samlp:AuthnRequest>
    `.trim();

    // Store request for validation later
    this.requestCache.set(requestId, {
      timestamp: Date.now(),
      returnUrl
    });

    // Base64 encode and URL encode the request
    const encodedRequest = Buffer.from(samlRequest).toString('base64');
    const urlEncodedRequest = encodeURIComponent(encodedRequest);
    
    // Generate redirect URL
    const url = `${this.config.ssoUrl}?SAMLRequest=${urlEncodedRequest}`;

    this.emit('authRequestGenerated', { requestId, url });
    this.logger.debug('SAML auth request generated', { requestId });

    return { requestId, url, samlRequest: encodedRequest };
  }

  /**
   * Parse and validate SAML response
   */
  public async validateResponse(samlResponse: string): Promise<SAMLUser> {
    try {
      // Decode the SAML response
      const decodedResponse = Buffer.from(samlResponse, 'base64').toString('utf-8');
      
      // Parse the XML (simplified for example - in production use xml2js or similar)
      const assertion = this.parseAssertion(decodedResponse);
      
      // Validate signature (simplified - in production use xml-crypto)
      if (!this.validateSignature(decodedResponse)) {
        throw new Error('Invalid SAML signature');
      }

      // Validate conditions
      this.validateConditions(assertion);

      // Extract user attributes
      const user = this.extractUser(assertion);
      
      // Store session
      this.sessionCache.set(user.id, user);
      
      this.emit('userAuthenticated', user);
      this.logger.info('User authenticated via SAML', { userId: user.id });

      return user;
    } catch (error) {
      this.logger.error('SAML response validation failed', error);
      throw error;
    }
  }

  /**
   * Generate logout request
   */
  public generateLogoutRequest(user: SAMLUser): { requestId: string; url: string } {
    const requestId = `_${crypto.randomBytes(16).toString('hex')}`;
    const timestamp = new Date().toISOString();
    
    const logoutRequest = `
      <samlp:LogoutRequest 
        xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" 
        xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"
        ID="${requestId}"
        Version="2.0"
        IssueInstant="${timestamp}"
        Destination="${this.config.sloUrl || this.config.ssoUrl}">
        <saml:Issuer>${this.config.issuer}</saml:Issuer>
        <saml:NameID Format="${this.config.nameIdFormat}">${user.nameId || user.email}</saml:NameID>
        ${user.sessionIndex ? `<samlp:SessionIndex>${user.sessionIndex}</samlp:SessionIndex>` : ''}
      </samlp:LogoutRequest>
    `.trim();

    const encodedRequest = Buffer.from(logoutRequest).toString('base64');
    const urlEncodedRequest = encodeURIComponent(encodedRequest);
    const url = `${this.config.sloUrl || this.config.ssoUrl}?SAMLRequest=${urlEncodedRequest}`;

    this.emit('logoutRequestGenerated', { requestId, userId: user.id });
    this.logger.debug('SAML logout request generated', { requestId, userId: user.id });

    return { requestId, url };
  }

  /**
   * Get authenticated user by ID
   */
  public getUser(userId: string): SAMLUser | undefined {
    return this.sessionCache.get(userId);
  }

  /**
   * Check if user is authenticated
   */
  public isAuthenticated(userId: string): boolean {
    const user = this.sessionCache.get(userId);
    if (!user) return false;

    // Check session age
    const sessionAge = Date.now() - (user.attributes?.authTime || 0);
    return sessionAge < (this.config.maxSessionAge || 86400000);
  }

  /**
   * Revoke user session
   */
  public revokeSession(userId: string): void {
    const deleted = this.sessionCache.delete(userId);
    if (deleted) {
      this.emit('sessionRevoked', { userId });
      this.logger.info('User session revoked', { userId });
    }
  }

  /**
   * Parse SAML assertion (simplified)
   */
  private parseAssertion(xml: string): SAMLAssertion {
    // Simplified parsing - in production use proper XML parser
    const nameIdMatch = xml.match(/<saml:NameID[^>]*>([^<]+)<\/saml:NameID>/);
    const nameId = nameIdMatch ? nameIdMatch[1] : '';
    
    const sessionIndexMatch = xml.match(/<samlp:SessionIndex>([^<]+)<\/samlp:SessionIndex>/);
    const sessionIndex = sessionIndexMatch ? sessionIndexMatch[1] : undefined;
    
    // Extract attributes (simplified)
    const attributes: Record<string, any> = {};
    const attributeRegex = /<saml:Attribute Name="([^"]+)"[^>]*>\s*<saml:AttributeValue[^>]*>([^<]+)<\/saml:AttributeValue>/g;
    let match;
    while ((match = attributeRegex.exec(xml)) !== null) {
      attributes[match[1]] = match[2];
    }

    // Extract conditions
    const notBeforeMatch = xml.match(/NotBefore="([^"]+)"/);
    const notOnOrAfterMatch = xml.match(/NotOnOrAfter="([^"]+)"/);
    
    return {
      nameId,
      sessionIndex,
      attributes,
      conditions: {
        notBefore: notBeforeMatch ? new Date(notBeforeMatch[1]) : undefined,
        notOnOrAfter: notOnOrAfterMatch ? new Date(notOnOrAfterMatch[1]) : undefined,
        audience: this.config.audience ? [this.config.audience] : []
      }
    };
  }

  /**
   * Validate SAML signature (simplified)
   */
  private validateSignature(xml: string): boolean {
    // In production, use xml-crypto library for proper signature validation
    // This is a simplified placeholder
    if (!this.config.certificate) {
      this.logger.warn('No certificate configured for signature validation');
      return true; // Skip validation if no cert
    }
    
    // Check if signature exists
    const hasSignature = xml.includes('<ds:Signature') || xml.includes('<Signature');
    if (!hasSignature) {
      this.logger.warn('No signature found in SAML response');
      return false;
    }

    // Placeholder for actual signature validation
    // Would use crypto.verify() with the certificate
    return true;
  }

  /**
   * Validate assertion conditions
   */
  private validateConditions(assertion: SAMLAssertion): void {
    const now = new Date();
    
    if (assertion.conditions) {
      if (assertion.conditions.notBefore && now < assertion.conditions.notBefore) {
        throw new Error('SAML assertion not yet valid');
      }
      
      if (assertion.conditions.notOnOrAfter && now >= assertion.conditions.notOnOrAfter) {
        throw new Error('SAML assertion expired');
      }
      
      if (assertion.conditions.audience && this.config.audience) {
        if (!assertion.conditions.audience.includes(this.config.audience)) {
          throw new Error('SAML assertion audience mismatch');
        }
      }
    }
  }

  /**
   * Extract user from assertion
   */
  private extractUser(assertion: SAMLAssertion): SAMLUser {
    const mapping = this.config.attributeMapping || {};
    const attributes = assertion.attributes;
    
    return {
      id: attributes[mapping.id || 'uid'] || assertion.nameId,
      email: attributes[mapping.email || 'email'] || 
              attributes[mapping.email || 'mail'] || 
              (assertion.nameId.includes('@') ? assertion.nameId : undefined),
      name: attributes[mapping.name || 'displayName'] || 
            attributes[mapping.name || 'cn'],
      firstName: attributes[mapping.firstName || 'givenName'],
      lastName: attributes[mapping.lastName || 'sn'] || 
                attributes[mapping.lastName || 'surname'],
      groups: this.parseMultiValue(attributes[mapping.groups || 'memberOf']),
      roles: this.parseMultiValue(attributes[mapping.roles || 'role']),
      attributes: {
        ...attributes,
        authTime: Date.now()
      },
      sessionIndex: assertion.sessionIndex,
      nameId: assertion.nameId
    };
  }

  /**
   * Parse multi-value attributes
   */
  private parseMultiValue(value: any): string[] | undefined {
    if (!value) return undefined;
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') return value.split(',').map(v => v.trim());
    return undefined;
  }

  /**
   * Clean up expired requests
   */
  private cleanupExpiredRequests(): void {
    const now = Date.now();
    const expiredIds: string[] = [];
    
    for (const [id, request] of this.requestCache.entries()) {
      if (now - request.timestamp > (this.config.requestIdExpirationPeriod || 300000)) {
        expiredIds.push(id);
      }
    }
    
    for (const id of expiredIds) {
      this.requestCache.delete(id);
    }
    
    if (expiredIds.length > 0) {
      this.logger.debug(`Cleaned up ${expiredIds.length} expired SAML requests`);
    }
  }

  /**
   * Get SAML metadata
   */
  public getMetadata(): string {
    return `
      <EntityDescriptor 
        xmlns="urn:oasis:names:tc:SAML:2.0:metadata"
        entityID="${this.config.entityId}">
        <SPSSODescriptor 
          protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol"
          AuthnRequestsSigned="${this.config.privateKey ? 'true' : 'false'}"
          WantAssertionsSigned="true">
          <NameIDFormat>${this.config.nameIdFormat}</NameIDFormat>
          <AssertionConsumerService 
            Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
            Location="${this.config.callbackUrl}"
            index="0"
            isDefault="true" />
          ${this.config.sloUrl ? `
          <SingleLogoutService 
            Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect"
            Location="${this.config.sloUrl}" />
          ` : ''}
        </SPSSODescriptor>
      </EntityDescriptor>
    `.trim();
  }
}