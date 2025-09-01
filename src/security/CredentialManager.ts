import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

interface Credential {
  id: string;
  service: string;
  username: string;
  encryptedPassword: string;
  encryptedToken?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  lastUsedAt?: Date;
  expiresAt?: Date;
}

interface CredentialOptions {
  service: string;
  username: string;
  password?: string;
  token?: string;
  metadata?: Record<string, any>;
  expiresAt?: Date;
}

interface StorageOptions {
  storagePath?: string;
  encryptionKey?: string;
  algorithm?: string;
  keyDerivationIterations?: number;
}

export class CredentialManager {
  private credentials: Map<string, Credential> = new Map();
  private storagePath: string;
  private encryptionKey: Buffer;
  private algorithm: string;
  private keyDerivationIterations: number;
  private isInitialized: boolean = false;

  constructor(options: StorageOptions = {}) {
    this.storagePath = options.storagePath || path.join(process.cwd(), '.playclone', 'credentials');
    this.algorithm = options.algorithm || 'aes-256-gcm';
    this.keyDerivationIterations = options.keyDerivationIterations || 100000;

    // Derive encryption key from provided key or generate new one
    if (options.encryptionKey) {
      this.encryptionKey = this.deriveKey(options.encryptionKey);
    } else {
      this.encryptionKey = this.generateKey();
    }
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    // Ensure storage directory exists
    const dir = path.dirname(this.storagePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Load existing credentials
    await this.loadCredentials();
    this.isInitialized = true;
  }

  private deriveKey(passphrase: string): Buffer {
    const salt = crypto.createHash('sha256').update('playclone-salt').digest();
    return crypto.pbkdf2Sync(passphrase, salt, this.keyDerivationIterations, 32, 'sha256');
  }

  private generateKey(): Buffer {
    // Generate a random key for this session
    // In production, this should be stored securely (e.g., in system keychain)
    return crypto.randomBytes(32);
  }

  private encrypt(text: string): { encrypted: string; iv: string; authTag: string } {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.algorithm, this.encryptionKey, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = (cipher as any).getAuthTag();
    
    return {
      encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex')
    };
  }

  private decrypt(encryptedData: string, iv: string, authTag: string): string {
    const decipher = crypto.createDecipheriv(
      this.algorithm,
      this.encryptionKey,
      Buffer.from(iv, 'hex')
    );
    
    (decipher as any).setAuthTag(Buffer.from(authTag, 'hex'));
    
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  async addCredential(options: CredentialOptions): Promise<string> {
    await this.initialize();

    const id = crypto.randomBytes(16).toString('hex');
    const now = new Date();

    const credential: Credential = {
      id,
      service: options.service,
      username: options.username,
      encryptedPassword: '',
      metadata: options.metadata,
      createdAt: now,
      updatedAt: now,
      expiresAt: options.expiresAt
    };

    // Encrypt password if provided
    if (options.password) {
      const { encrypted, iv, authTag } = this.encrypt(options.password);
      credential.encryptedPassword = JSON.stringify({ encrypted, iv, authTag });
    }

    // Encrypt token if provided
    if (options.token) {
      const { encrypted, iv, authTag } = this.encrypt(options.token);
      credential.encryptedToken = JSON.stringify({ encrypted, iv, authTag });
    }

    this.credentials.set(id, credential);
    await this.saveCredentials();

    return id;
  }

  async getCredential(id: string): Promise<{
    service: string;
    username: string;
    password?: string;
    token?: string;
    metadata?: Record<string, any>;
  } | null> {
    await this.initialize();

    const credential = this.credentials.get(id);
    if (!credential) return null;

    // Check if expired
    if (credential.expiresAt && new Date() > credential.expiresAt) {
      await this.deleteCredential(id);
      return null;
    }

    // Update last used timestamp
    credential.lastUsedAt = new Date();
    await this.saveCredentials();

    const result: any = {
      service: credential.service,
      username: credential.username,
      metadata: credential.metadata
    };

    // Decrypt password if available
    if (credential.encryptedPassword) {
      try {
        const { encrypted, iv, authTag } = JSON.parse(credential.encryptedPassword);
        result.password = this.decrypt(encrypted, iv, authTag);
      } catch (error) {
        console.error('Failed to decrypt password:', error);
      }
    }

    // Decrypt token if available
    if (credential.encryptedToken) {
      try {
        const { encrypted, iv, authTag } = JSON.parse(credential.encryptedToken);
        result.token = this.decrypt(encrypted, iv, authTag);
      } catch (error) {
        console.error('Failed to decrypt token:', error);
      }
    }

    return result;
  }

  async findCredentials(service: string): Promise<string[]> {
    await this.initialize();

    const ids: string[] = [];
    for (const [id, credential] of this.credentials) {
      if (credential.service === service) {
        // Check if expired
        if (!credential.expiresAt || new Date() <= credential.expiresAt) {
          ids.push(id);
        }
      }
    }

    return ids;
  }

  async updateCredential(id: string, updates: Partial<CredentialOptions>): Promise<boolean> {
    await this.initialize();

    const credential = this.credentials.get(id);
    if (!credential) return false;

    credential.updatedAt = new Date();

    if (updates.username !== undefined) {
      credential.username = updates.username;
    }

    if (updates.password !== undefined) {
      const { encrypted, iv, authTag } = this.encrypt(updates.password);
      credential.encryptedPassword = JSON.stringify({ encrypted, iv, authTag });
    }

    if (updates.token !== undefined) {
      const { encrypted, iv, authTag } = this.encrypt(updates.token);
      credential.encryptedToken = JSON.stringify({ encrypted, iv, authTag });
    }

    if (updates.metadata !== undefined) {
      credential.metadata = updates.metadata;
    }

    if (updates.expiresAt !== undefined) {
      credential.expiresAt = updates.expiresAt;
    }

    await this.saveCredentials();
    return true;
  }

  async deleteCredential(id: string): Promise<boolean> {
    await this.initialize();

    const deleted = this.credentials.delete(id);
    if (deleted) {
      await this.saveCredentials();
    }

    return deleted;
  }

  async deleteAllCredentials(): Promise<void> {
    await this.initialize();

    this.credentials.clear();
    await this.saveCredentials();
  }

  async listCredentials(): Promise<Array<{
    id: string;
    service: string;
    username: string;
    createdAt: Date;
    lastUsedAt?: Date;
    expiresAt?: Date;
  }>> {
    await this.initialize();

    const list = [];
    for (const [id, credential] of this.credentials) {
      // Skip expired credentials
      if (credential.expiresAt && new Date() > credential.expiresAt) {
        continue;
      }

      list.push({
        id,
        service: credential.service,
        username: credential.username,
        createdAt: credential.createdAt,
        lastUsedAt: credential.lastUsedAt,
        expiresAt: credential.expiresAt
      });
    }

    return list;
  }

  async rotateEncryptionKey(newPassphrase: string): Promise<void> {
    await this.initialize();

    // Decrypt all credentials with old key
    const decryptedCredentials = new Map<string, any>();
    for (const [id, credential] of this.credentials) {
      const decrypted: any = {
        ...credential,
        password: null,
        token: null
      };

      if (credential.encryptedPassword) {
        try {
          const { encrypted, iv, authTag } = JSON.parse(credential.encryptedPassword);
          decrypted.password = this.decrypt(encrypted, iv, authTag);
        } catch (error) {
          console.error(`Failed to decrypt password for ${id}:`, error);
        }
      }

      if (credential.encryptedToken) {
        try {
          const { encrypted, iv, authTag } = JSON.parse(credential.encryptedToken);
          decrypted.token = this.decrypt(encrypted, iv, authTag);
        } catch (error) {
          console.error(`Failed to decrypt token for ${id}:`, error);
        }
      }

      decryptedCredentials.set(id, decrypted);
    }

    // Update encryption key
    this.encryptionKey = this.deriveKey(newPassphrase);

    // Re-encrypt all credentials with new key
    this.credentials.clear();
    for (const [id, decrypted] of decryptedCredentials) {
      const credential: Credential = {
        id: decrypted.id,
        service: decrypted.service,
        username: decrypted.username,
        encryptedPassword: '',
        metadata: decrypted.metadata,
        createdAt: decrypted.createdAt,
        updatedAt: new Date(),
        lastUsedAt: decrypted.lastUsedAt,
        expiresAt: decrypted.expiresAt
      };

      if (decrypted.password) {
        const { encrypted, iv, authTag } = this.encrypt(decrypted.password);
        credential.encryptedPassword = JSON.stringify({ encrypted, iv, authTag });
      }

      if (decrypted.token) {
        const { encrypted, iv, authTag } = this.encrypt(decrypted.token);
        credential.encryptedToken = JSON.stringify({ encrypted, iv, authTag });
      }

      this.credentials.set(id, credential);
    }

    await this.saveCredentials();
  }

  private async loadCredentials(): Promise<void> {
    if (!fs.existsSync(this.storagePath)) {
      return;
    }

    try {
      const data = fs.readFileSync(this.storagePath, 'utf8');
      const stored = JSON.parse(data);

      // Decrypt the stored data
      const { encrypted, iv, authTag } = stored;
      const decryptedData = this.decrypt(encrypted, iv, authTag);
      const credentials = JSON.parse(decryptedData);

      // Restore credentials with proper date objects
      for (const cred of credentials) {
        cred.createdAt = new Date(cred.createdAt);
        cred.updatedAt = new Date(cred.updatedAt);
        if (cred.lastUsedAt) cred.lastUsedAt = new Date(cred.lastUsedAt);
        if (cred.expiresAt) cred.expiresAt = new Date(cred.expiresAt);
        this.credentials.set(cred.id, cred);
      }
    } catch (error) {
      console.error('Failed to load credentials:', error);
      // Start with empty credentials if loading fails
      this.credentials.clear();
    }
  }

  private async saveCredentials(): Promise<void> {
    const credentials = Array.from(this.credentials.values());
    const data = JSON.stringify(credentials);

    // Encrypt the entire credentials file
    const { encrypted, iv, authTag } = this.encrypt(data);
    const stored = JSON.stringify({ encrypted, iv, authTag }, null, 2);

    // Ensure directory exists
    const dir = path.dirname(this.storagePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Write with restrictive permissions (owner read/write only)
    fs.writeFileSync(this.storagePath, stored, { mode: 0o600 });
  }

  async exportCredentials(exportPath: string, exportPassphrase: string): Promise<void> {
    await this.initialize();

    // Derive export key from passphrase
    const exportKey = this.deriveKey(exportPassphrase);

    // Prepare credentials for export
    const credentials = Array.from(this.credentials.values());
    const data = JSON.stringify(credentials);

    // Encrypt with export key
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.algorithm, exportKey, iv);
    
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = (cipher as any).getAuthTag();

    const exported = JSON.stringify({
      version: '1.0',
      algorithm: this.algorithm,
      encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex')
    }, null, 2);

    fs.writeFileSync(exportPath, exported, { mode: 0o600 });
  }

  async importCredentials(importPath: string, importPassphrase: string, merge: boolean = false): Promise<void> {
    await this.initialize();

    const data = fs.readFileSync(importPath, 'utf8');
    const imported = JSON.parse(data);

    // Derive import key from passphrase
    const importKey = this.deriveKey(importPassphrase);

    // Decrypt imported data
    const decipher = crypto.createDecipheriv(
      imported.algorithm || this.algorithm,
      importKey,
      Buffer.from(imported.iv, 'hex')
    );
    
    (decipher as any).setAuthTag(Buffer.from(imported.authTag, 'hex'));
    
    let decrypted = decipher.update(imported.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    const credentials = JSON.parse(decrypted);

    if (!merge) {
      this.credentials.clear();
    }

    // Import credentials
    for (const cred of credentials) {
      cred.createdAt = new Date(cred.createdAt);
      cred.updatedAt = new Date(cred.updatedAt);
      if (cred.lastUsedAt) cred.lastUsedAt = new Date(cred.lastUsedAt);
      if (cred.expiresAt) cred.expiresAt = new Date(cred.expiresAt);
      
      // Generate new ID if merging to avoid conflicts
      if (merge) {
        cred.id = crypto.randomBytes(16).toString('hex');
      }
      
      this.credentials.set(cred.id, cred);
    }

    await this.saveCredentials();
  }
}