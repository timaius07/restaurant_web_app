const crypto = require('crypto');

// Usamos una clave fuerte proporcionada por el entorno, o un fallback fijo y robusto
const SECRET_KEY = process.env.ENCRYPTION_KEY || 'SuperSecretKey_SodaApp_2026_AES!'; 
const ALGORITHM = 'aes-256-gcm';

// Asegurarse de que la clave tenga exactamente 32 bytes
const key = crypto.createHash('sha256').update(SECRET_KEY).digest();

function encrypt(text) {
  if (!text) return text;
  try {
    const iv = crypto.randomBytes(12); // 12 bytes es ideal para GCM
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    let encrypted = cipher.update(String(text), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag().toString('hex');
    
    // Retornamos iv:authTag:encrypted
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
  } catch (err) {
    console.error('Error encrypting data:', err);
    throw new Error('Encryption failed');
  }
}

function decrypt(encryptedText) {
  if (!encryptedText) return encryptedText;
  
  // Si el texto no parece estar encriptado con nuestro formato, retornamos tal cual
  if (typeof encryptedText !== 'string' || !encryptedText.includes(':')) {
    return encryptedText;
  }

  try {
    const parts = encryptedText.split(':');
    if (parts.length !== 3) return encryptedText;

    const [ivHex, authTagHex, encryptedHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (err) {
    console.error('Error decrypting data:', err);
    return encryptedText;
  }
}

module.exports = {
  encrypt,
  decrypt
};
