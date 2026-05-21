#!/usr/bin/env bash
# AISquare Hyperledger Fabric 자동 부트스트랩
# 클론 직후 한 번만 실행하면 체인코드까지 commit + .env Fabric 값 출력
#
# 사용법:
#   cd fabric && ./setup.sh
#
# 전제:
#   - Docker + docker compose 설치됨
#   - curl, tar 사용 가능
#   - 인터넷 (Fabric 바이너리·도커 이미지 다운로드)

set -euo pipefail

# ──────────────────────────────────────────────────────────────────────────
# 0. 디렉토리 위치 잡기
# ──────────────────────────────────────────────────────────────────────────
FABRIC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$FABRIC_DIR"

FABRIC_VERSION="2.5.10"
NETWORK_DIR="$FABRIC_DIR/network"
CHAINCODE_DIR="$FABRIC_DIR/chaincode"

echo "===================================================="
echo " AISquare Fabric 부트스트랩 (v$FABRIC_VERSION)"
echo " FABRIC_DIR: $FABRIC_DIR"
echo "===================================================="
echo ""

# ──────────────────────────────────────────────────────────────────────────
# 1. Fabric 바이너리 다운로드 (cryptogen, configtxgen, peer, osnadmin)
# ──────────────────────────────────────────────────────────────────────────
if [ ! -x "$FABRIC_DIR/bin/peer" ]; then
  echo "[1/7] Fabric 바이너리 다운로드..."
  curl -sSL -o install.sh https://raw.githubusercontent.com/hyperledger/fabric/main/scripts/install-fabric.sh
  chmod +x install.sh
  ./install.sh -f "$FABRIC_VERSION" binary
  rm -f install.sh
else
  echo "[1/7] Fabric 바이너리 이미 있음 → skip"
fi

export PATH="$FABRIC_DIR/bin:$PATH"
export FABRIC_CFG_PATH="$FABRIC_DIR/config"

# core.yaml/orderer.yaml 다운로드 (configtxgen·peer 작동에 필요)
mkdir -p "$FABRIC_CFG_PATH"
if [ ! -f "$FABRIC_CFG_PATH/core.yaml" ]; then
  curl -sSL "https://raw.githubusercontent.com/hyperledger/fabric/v${FABRIC_VERSION}/sampleconfig/core.yaml" -o "$FABRIC_CFG_PATH/core.yaml"
fi
if [ ! -f "$FABRIC_CFG_PATH/orderer.yaml" ]; then
  curl -sSL "https://raw.githubusercontent.com/hyperledger/fabric/v${FABRIC_VERSION}/sampleconfig/orderer.yaml" -o "$FABRIC_CFG_PATH/orderer.yaml"
fi

# ──────────────────────────────────────────────────────────────────────────
# 2. crypto material 생성 (cryptogen) — Orderer + AISquare + NaverPay
# ──────────────────────────────────────────────────────────────────────────
cd "$NETWORK_DIR"
if [ ! -d "$NETWORK_DIR/crypto-config/peerOrganizations" ]; then
  echo "[2/7] 인증서 발급 (cryptogen)..."
  cryptogen generate --config=./crypto-config.yaml --output=./crypto-config
else
  echo "[2/7] crypto-config/ 이미 존재 → skip"
fi

# ──────────────────────────────────────────────────────────────────────────
# 3. genesis blocks 생성 (configtxgen) — internal-channel + naver-channel
# ──────────────────────────────────────────────────────────────────────────
mkdir -p channel-artifacts
export FABRIC_CFG_PATH="$NETWORK_DIR"

if [ ! -f channel-artifacts/internal.block ]; then
  echo "[3/7] internal-channel genesis block..."
  configtxgen -profile InternalGenesis -outputBlock channel-artifacts/internal.block -channelID internal-channel
fi
if [ ! -f channel-artifacts/naver.block ]; then
  echo "      naver-channel genesis block..."
  configtxgen -profile NaverChannelGenesis -outputBlock channel-artifacts/naver.block -channelID naver-channel
fi

# ──────────────────────────────────────────────────────────────────────────
# 4. Docker 네트워크 + 컨테이너 기동
# ──────────────────────────────────────────────────────────────────────────
echo "[4/7] Docker 컨테이너 기동 (orderer + AISquare peer + NaverPay peer + cli)..."
docker compose up -d
sleep 5

docker ps --format "{{.Names}}" | grep -E "orderer|peer0|cli" || {
  echo "ERROR: 컨테이너 기동 실패"
  docker compose logs --tail 30
  exit 1
}

# ──────────────────────────────────────────────────────────────────────────
# 5. 채널 생성 (osnadmin) + peer join
# ──────────────────────────────────────────────────────────────────────────
echo "[5/7] 채널 생성 + peer join..."
docker exec fabric-cli bash -c '
set -e
ORDERER_CA=/etc/hyperledger/crypto-config/ordererOrganizations/example.com/orderers/orderer.example.com/tls/ca.crt
ORDERER_CRT=/etc/hyperledger/crypto-config/ordererOrganizations/example.com/orderers/orderer.example.com/tls/server.crt
ORDERER_KEY=/etc/hyperledger/crypto-config/ordererOrganizations/example.com/orderers/orderer.example.com/tls/server.key

# orderer에 두 채널 생성 (이미 있으면 무시)
osnadmin channel join --channelID internal-channel --config-block /etc/hyperledger/channel-artifacts/internal.block \
  -o orderer.example.com:7053 --ca-file $ORDERER_CA --client-cert $ORDERER_CRT --client-key $ORDERER_KEY 2>&1 | grep -v "already exists" || true

osnadmin channel join --channelID naver-channel --config-block /etc/hyperledger/channel-artifacts/naver.block \
  -o orderer.example.com:7053 --ca-file $ORDERER_CA --client-cert $ORDERER_CRT --client-key $ORDERER_KEY 2>&1 | grep -v "already exists" || true

# AISquare peer → 두 채널 join
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_LOCALMSPID=AISquareMSP
export CORE_PEER_TLS_ROOTCERT_FILE=/etc/hyperledger/crypto-config/peerOrganizations/aisquare.com/peers/peer0.aisquare.com/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=/etc/hyperledger/crypto-config/peerOrganizations/aisquare.com/users/Admin@aisquare.com/msp
export CORE_PEER_ADDRESS=peer0.aisquare.com:7051
peer channel join -b /etc/hyperledger/channel-artifacts/internal.block 2>&1 | grep -v "already joined" || true
peer channel join -b /etc/hyperledger/channel-artifacts/naver.block 2>&1 | grep -v "already joined" || true

# NaverPay peer → naver-channel join
export CORE_PEER_LOCALMSPID=NaverPayMSP
export CORE_PEER_TLS_ROOTCERT_FILE=/etc/hyperledger/crypto-config/peerOrganizations/naverpay.com/peers/peer0.naverpay.com/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=/etc/hyperledger/crypto-config/peerOrganizations/naverpay.com/users/Admin@naverpay.com/msp
export CORE_PEER_ADDRESS=peer0.naverpay.com:8051
peer channel join -b /etc/hyperledger/channel-artifacts/naver.block 2>&1 | grep -v "already joined" || true
'

# ──────────────────────────────────────────────────────────────────────────
# 6. 체인코드 vendor 모듈 + 패키지 + install + approve + commit
# ──────────────────────────────────────────────────────────────────────────
echo "[6/7] 체인코드 빌드 + 배포..."
docker exec fabric-cli bash -c '
set -e
for cc in exchange wallet; do
  if [ ! -d /opt/chaincode/$cc/vendor ]; then
    echo "  → $cc: go mod vendor"
    cd /opt/chaincode/$cc && go mod tidy && go mod vendor
  fi
done
'

# 미리 fabric-ccenv 이미지 pull (chaincode 빌드에 필요)
docker pull -q hyperledger/fabric-ccenv:2.5 >/dev/null 2>&1 || true
docker pull -q hyperledger/fabric-baseos:2.5 >/dev/null 2>&1 || true

# ── exchange chaincode → naver-channel
docker exec fabric-cli bash -c '
set -e
export CORE_PEER_TLS_ENABLED=true
ORDERER_CA=/etc/hyperledger/crypto-config/ordererOrganizations/example.com/orderers/orderer.example.com/tls/ca.crt

# Package
peer lifecycle chaincode package /tmp/exchange.tar.gz --path /opt/chaincode/exchange --lang golang --label exchange_1

# Install on both peers
export CORE_PEER_LOCALMSPID=AISquareMSP
export CORE_PEER_TLS_ROOTCERT_FILE=/etc/hyperledger/crypto-config/peerOrganizations/aisquare.com/peers/peer0.aisquare.com/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=/etc/hyperledger/crypto-config/peerOrganizations/aisquare.com/users/Admin@aisquare.com/msp
export CORE_PEER_ADDRESS=peer0.aisquare.com:7051
peer lifecycle chaincode install /tmp/exchange.tar.gz 2>&1 | tail -1

export CORE_PEER_LOCALMSPID=NaverPayMSP
export CORE_PEER_TLS_ROOTCERT_FILE=/etc/hyperledger/crypto-config/peerOrganizations/naverpay.com/peers/peer0.naverpay.com/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=/etc/hyperledger/crypto-config/peerOrganizations/naverpay.com/users/Admin@naverpay.com/msp
export CORE_PEER_ADDRESS=peer0.naverpay.com:8051
peer lifecycle chaincode install /tmp/exchange.tar.gz 2>&1 | tail -1

# Get package ID
export CORE_PEER_LOCALMSPID=AISquareMSP
export CORE_PEER_TLS_ROOTCERT_FILE=/etc/hyperledger/crypto-config/peerOrganizations/aisquare.com/peers/peer0.aisquare.com/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=/etc/hyperledger/crypto-config/peerOrganizations/aisquare.com/users/Admin@aisquare.com/msp
export CORE_PEER_ADDRESS=peer0.aisquare.com:7051
PKG_ID=$(peer lifecycle chaincode queryinstalled 2>&1 | grep exchange_1 | head -1 | awk "{print \$3}" | tr -d ",")
echo "  → exchange PACKAGE_ID=$PKG_ID"

# Approve from both orgs
peer lifecycle chaincode approveformyorg -o orderer.example.com:7050 --tls --cafile $ORDERER_CA --channelID naver-channel --name exchange --version 1.0 --package-id $PKG_ID --sequence 1 2>&1 | tail -1

export CORE_PEER_LOCALMSPID=NaverPayMSP
export CORE_PEER_TLS_ROOTCERT_FILE=/etc/hyperledger/crypto-config/peerOrganizations/naverpay.com/peers/peer0.naverpay.com/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=/etc/hyperledger/crypto-config/peerOrganizations/naverpay.com/users/Admin@naverpay.com/msp
export CORE_PEER_ADDRESS=peer0.naverpay.com:8051
peer lifecycle chaincode approveformyorg -o orderer.example.com:7050 --tls --cafile $ORDERER_CA --channelID naver-channel --name exchange --version 1.0 --package-id $PKG_ID --sequence 1 2>&1 | tail -1

# Commit (양 조직 endorse)
peer lifecycle chaincode commit -o orderer.example.com:7050 --tls --cafile $ORDERER_CA --channelID naver-channel --name exchange --version 1.0 --sequence 1 \
  --peerAddresses peer0.aisquare.com:7051 --tlsRootCertFiles /etc/hyperledger/crypto-config/peerOrganizations/aisquare.com/peers/peer0.aisquare.com/tls/ca.crt \
  --peerAddresses peer0.naverpay.com:8051 --tlsRootCertFiles /etc/hyperledger/crypto-config/peerOrganizations/naverpay.com/peers/peer0.naverpay.com/tls/ca.crt 2>&1 | tail -1
'

# ── wallet chaincode → internal-channel
docker exec fabric-cli bash -c '
set -e
export CORE_PEER_TLS_ENABLED=true
ORDERER_CA=/etc/hyperledger/crypto-config/ordererOrganizations/example.com/orderers/orderer.example.com/tls/ca.crt

peer lifecycle chaincode package /tmp/wallet.tar.gz --path /opt/chaincode/wallet --lang golang --label wallet_1

export CORE_PEER_LOCALMSPID=AISquareMSP
export CORE_PEER_TLS_ROOTCERT_FILE=/etc/hyperledger/crypto-config/peerOrganizations/aisquare.com/peers/peer0.aisquare.com/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=/etc/hyperledger/crypto-config/peerOrganizations/aisquare.com/users/Admin@aisquare.com/msp
export CORE_PEER_ADDRESS=peer0.aisquare.com:7051
peer lifecycle chaincode install /tmp/wallet.tar.gz 2>&1 | tail -1

PKG_ID=$(peer lifecycle chaincode queryinstalled 2>&1 | grep wallet_1 | head -1 | awk "{print \$3}" | tr -d ",")
echo "  → wallet PACKAGE_ID=$PKG_ID"

peer lifecycle chaincode approveformyorg -o orderer.example.com:7050 --tls --cafile $ORDERER_CA --channelID internal-channel --name wallet --version 1.0 --package-id $PKG_ID --sequence 1 2>&1 | tail -1
peer lifecycle chaincode commit -o orderer.example.com:7050 --tls --cafile $ORDERER_CA --channelID internal-channel --name wallet --version 1.0 --sequence 1 \
  --peerAddresses peer0.aisquare.com:7051 --tlsRootCertFiles /etc/hyperledger/crypto-config/peerOrganizations/aisquare.com/peers/peer0.aisquare.com/tls/ca.crt 2>&1 | tail -1

echo ""
echo "  ── Final state ──"
peer lifecycle chaincode querycommitted --channelID internal-channel 2>&1 | tail -2
peer lifecycle chaincode querycommitted --channelID naver-channel 2>&1 | tail -2
'

# ──────────────────────────────────────────────────────────────────────────
# 7. BE .env에 추가할 Fabric 값 출력
# ──────────────────────────────────────────────────────────────────────────
cd "$NETWORK_DIR"
ADMIN_CERT_B64=$(base64 -w0 < crypto-config/peerOrganizations/aisquare.com/users/Admin@aisquare.com/msp/signcerts/Admin@aisquare.com-cert.pem)
ADMIN_KEY_B64=$(base64 -w0 < crypto-config/peerOrganizations/aisquare.com/users/Admin@aisquare.com/msp/keystore/priv_sk)
TLS_CA_PATH="$(realpath crypto-config/peerOrganizations/aisquare.com/peers/peer0.aisquare.com/tls/ca.crt)"

echo ""
echo "===================================================="
echo "[7/7] ✅ 부트스트랩 완료!"
echo "===================================================="
echo ""
echo "↓ backend/.env 에 아래 값을 추가하세요 (또는 기존 값 갱신):"
echo ""
cat <<EOF
# ── Fabric ──
FABRIC_ENABLED="true"
FABRIC_PEER_ENDPOINT="localhost:7051"
FABRIC_TLS_CERT_PATH="$TLS_CA_PATH"
FABRIC_MSP_ID="AISquareMSP"
FABRIC_ADMIN_CERT_BASE64="$ADMIN_CERT_B64"
FABRIC_ADMIN_KEY_BASE64="$ADMIN_KEY_B64"
EOF

echo ""
echo "이후:"
echo "  cd ../backend"
echo "  npm install"
echo "  npx prisma generate && npx prisma db push"
echo "  npx nest start    # BE → Fabric 자동 연결"
echo ""
