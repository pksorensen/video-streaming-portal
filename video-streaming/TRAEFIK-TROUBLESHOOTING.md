# Traefik RTMP EntryPoint Troubleshooting

## Current Error
```
ERR EntryPoint doesn't exist entryPointName=rtmp routerName=streaming-rtmp@docker
ERR No valid entryPoint for this router routerName=streaming-rtmp@docker
```

## Possible Causes & Solutions

### 1. Traefik Not Restarted
**Problem**: Configuration changes require Traefik restart
**Solution**: 
- In Coolify UI: Stop → Start Traefik service
- Or restart the entire Coolify server

### 2. Configuration Not Applied
**Problem**: Static config wasn't properly saved
**Solution**: Verify in Coolify UI → Settings → Traefik → Static Configuration

Check if this exists:
```yaml
entryPoints:
  rtmp:
    address: ":1935"
```

### 3. YAML Syntax Error
**Problem**: Indentation or syntax issues
**Solution**: Use this exact format (spaces, not tabs):

```yaml
entryPoints:
  web:
    address: ":80"
  websecure:
    address: ":443"
  rtmp:
    address: ":1935"
```

### 4. Port Already in Use
**Problem**: Port 1935 might be occupied
**Solution**: Check with:
```bash
netstat -tlnp | grep 1935
# or
ss -tlnp | grep 1935
```

### 5. Coolify Version Limitations
**Problem**: Some Coolify versions have limited Traefik customization
**Solution**: Use alternative approaches below

## Alternative Solutions

### Option A: Use Different Port for RTMP
Change the RTMP entrypoint to a different port:

```yaml
entryPoints:
  rtmp:
    address: ":1936"  # Use different port
```

Then update docker-compose labels:
```yaml
- "traefik.tcp.routers.streaming-rtmp.entrypoints=rtmp"
```

### Option B: Remove Custom EntryPoint (Recommended)
Remove the custom RTMP routing and use Coolify's manual port mapping:

1. **Remove Traefik labels from docker-compose.coolify.yml**:
```yaml
# Remove these lines:
# - "traefik.tcp.routers.streaming-rtmp.rule=HostSNI(`*`)"
# - "traefik.tcp.routers.streaming-rtmp.entrypoints=rtmp"
# - "traefik.tcp.services.streaming-rtmp.loadbalancer.server.port=1935"
```

2. **Add port binding back for RTMP only**:
```yaml
services:
  streaming-platform:
    # ... other config ...
    ports:
      - "1935:1935"  # Only RTMP port
    # ... rest of config ...
```

3. **Use Coolify UI for HTTP ports**:
   - Map container port 3000 to your domain
   - Map container port 8000 to subdomain/path

### Option C: Use Host Networking (Not Recommended)
```yaml
services:
  streaming-platform:
    network_mode: host
```

## Debugging Steps

### 1. Check Traefik Configuration
```bash
# Inside Traefik container
cat /etc/traefik/traefik.yml
# or
cat /data/traefik.yml
```

### 2. Check Traefik Logs
```bash
docker logs traefik-container-name 2>&1 | grep -i entrypoint
```

### 3. Verify Container Network
```bash
docker network ls
docker network inspect coolify
```

### 4. Test Port Accessibility
```bash
# From host
telnet stream-app.kjeldager.io 1935

# From inside network
docker exec -it streaming-platform nc -zv localhost 1935
```

## Recommended Solution

Given the persistent error, I recommend **Option B** - removing the custom entrypoint and using a hybrid approach:

1. Keep HTTP/HTTPS routing via Traefik labels
2. Expose RTMP directly via port binding
3. Use Coolify UI for web interface routing

This gives you:
- ✅ Automatic HTTPS for web interface
- ✅ Direct RTMP access without custom entrypoints
- ✅ Simpler configuration
- ✅ Better compatibility with Coolify

Would you like me to create this hybrid configuration?