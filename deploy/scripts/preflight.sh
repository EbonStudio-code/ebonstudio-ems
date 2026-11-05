#!/usr/bin/env bash
set -euo pipefail
# Read-only. Run inside guest products (VM 101), never on the Proxmox host.
printf 'UTC: '; date -u +%FT%TZ
printf 'Guest: '; hostname
printf 'Kernel: '; uname -srmo
printf 'OS: '
# shellcheck source=/dev/null
. /etc/os-release
printf '%s %s\n' "$ID" "$VERSION_ID"
[[ "$ID" = debian && "$VERSION_ID" = 13 ]] || { echo "Unexpected guest OS. Stop."; exit 1; }
[[ "$(hostname -s)" = products ]] || { echo "Unexpected guest hostname. Verify VM 101 before proceeding."; exit 1; }
if [[ -e /etc/pve ]]; then echo "Refusing a Proxmox host"; exit 1; fi
systemd-detect-virt || true
free -h
df -h / /var/lib/docker
ss -lntup
docker version --format '{{.Server.Version}}'
docker compose version
docker info --format 'OS={{.OSType}} architecture={{.Architecture}} cgroup={{.CgroupVersion}}'
docker ps -a --format 'name={{.Names}} image={{.Image}} state={{.Status}} ports={{.Ports}} project={{.Label "com.docker.compose.project"}}'
docker network ls
docker volume ls
docker stats --no-stream --format 'name={{.Name}} memory={{.MemUsage}} cpu={{.CPUPerc}}'
systemctl list-units --type=service --state=running --no-pager
echo "Inventory only. Review collisions, route overlap, ingress and spare capacity before approval."
