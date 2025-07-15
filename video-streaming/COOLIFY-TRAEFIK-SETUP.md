# Coolify Traefik RTMP Configuration

## Error Resolution

The error you're seeing:
```
ERR EntryPoint doesn't exist entryPointName=rtmp routerName=streaming-rtmp@docker
```

This happens because Traefik doesn't have the `rtmp` entrypoint defined in its static configuration.

## Solution: Add RTMP EntryPoint to Coolify

### Method 1: Coolify UI Configuration

1. Go to your Coolify dashboard
2. Navigate to **Settings** → **Configuration** → **Traefik**
3. Find the **Static Configuration** section
4. Add this configuration to your existing Traefik static config:

```yaml
entryPoints:
  web:
    address: ":80"
  websecure:
    address: ":443"
  rtmp:
    address: ":1935"  # Add this RTMP entrypoint
```

### Method 2: Complete Static Configuration

If you need the full static configuration, replace your Traefik config with:

```yaml
# Entry Points Configuration
entryPoints:
  web:
    address: ":80"
    http:
      redirections:
        entryPoint:
          to: websecure
          scheme: https
          permanent: true

  websecure:
    address: ":443"
    http:
      tls:
        certResolver: letsencrypt

  # RTMP TCP Entry Point for Streaming
  rtmp:
    address: ":1935"

# Certificate Resolver (Let's Encrypt)
certificatesResolvers:
  letsencrypt:
    acme:
      email: your-email@kjeldager.io  # Replace with your email
      storage: /data/acme.json
      httpChallenge:
        entryPoint: web

# API and Dashboard
api:
  dashboard: true
  insecure: false

# Providers
providers:
  docker:
    endpoint: "unix:///var/run/docker.sock"
    exposedByDefault: false
    network: coolify

# Global Configuration
global:
  checkNewVersion: false
  sendAnonymousUsage: false

# Log Configuration
log:
  level: INFO

accessLog: {}
```

### Method 3: Environment Variable (Alternative)

If Coolify supports environment variables for Traefik configuration, add:

```bash
TRAEFIK_ENTRYPOINTS_RTMP_ADDRESS=:1935
```

## After Configuration

1. **Restart Traefik** in Coolify after adding the configuration
2. **Deploy your application** with the docker-compose.coolify.yml
3. **Test RTMP connection**:
   ```bash
   # Test with ffmpeg
   ffmpeg -f lavfi -i testsrc=duration=10:size=320x240:rate=30 \
          -f flv rtmp://stream-app.kjeldager.io:1935/live/test-key
   ```

## Verification

After restart, check Traefik logs. The error should disappear and you should see:
```
INF entryPoint created entryPointName=rtmp
```

## Access URLs After Setup

- **Web Interface**: `https://stream-app.kjeldager.io`
- **RTMP Streaming**: `rtmp://stream-app.kjeldager.io:1935/live/your-stream-key`
- **HTTP-FLV Playback**: `https://stream-app.kjeldager.io/live/your-stream-key.flv`

## Firewall Configuration

Ensure port 1935 is open on your server:
```bash
# UFW
sudo ufw allow 1935/tcp

# iptables
sudo iptables -A INPUT -p tcp --dport 1935 -j ACCEPT
```

## Troubleshooting

### Still Getting EntryPoint Error?
1. Verify the YAML syntax is correct (no tabs, proper spacing)
2. Ensure you restarted Traefik after configuration changes
3. Check Coolify's Traefik logs for configuration parsing errors

### RTMP Connection Refused?
1. Verify the container is running and healthy
2. Check that port 1935 is accessible from your client
3. Ensure the stream key and path (`/live/`) are correct