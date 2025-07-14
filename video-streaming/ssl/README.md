# SSL Certificate Setup

This directory is for SSL certificates to enable HTTPS streaming.

## For Development (Self-signed certificates):

```bash
# Generate private key
openssl genrsa -out privatekey.pem 2048

# Generate certificate
openssl req -new -x509 -key privatekey.pem -out certificate.pem -days 365
```

## For Production:

1. Obtain certificates from a Certificate Authority (Let's Encrypt, etc.)
2. Place your certificate files here:
   - `privatekey.pem` - Private key
   - `certificate.pem` - Certificate file

## Enable HTTPS:

Set environment variable: `ENABLE_HTTPS=true`

The server will automatically use HTTPS when certificates are available.