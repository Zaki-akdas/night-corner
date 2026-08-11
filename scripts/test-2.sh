#!/bin/bash
BASE=http://localhost:3000
PASS=0; FAIL=0
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
check() { if [ "$2" = "$3" ]; then echo -e "${GREEN}  ✅ PASS${NC} $1"; PASS=$((PASS+1)); else echo -e "${RED}  ❌ FAIL${NC} $1 (expected $2, got $3)"; FAIL=$((FAIL+1)); fi; }
check_contains() { if echo "$3" | grep -q "$2"; then echo -e "${GREEN}  ✅ PASS${NC} $1"; PASS=$((PASS+1)); else echo -e "${RED}  ❌ FAIL${NC} $1 — missing '$2'"; FAIL=$((FAIL+1)); fi; }
section() { echo -e "\n${YELLOW}━━ $1 ━━${NC}"; }

JAR_C=/tmp/nc-customer.txt; JAR_A=/tmp/nc-admin.txt
http() { curl -s -o /tmp/nc-body.txt -w "%{http_code}" "$@"; BODY=$(cat /tmp/nc-body.txt); }

login() { local jar=$1 email=$2 pass=$3
  local csrf=$(curl -s -c $jar $BASE/api/auth/csrf | python3 -c "import sys,json;print(json.load(sys.stdin)['csrfToken'])")
  curl -s -b $jar -c $jar -o /dev/null -X POST $BASE/api/auth/callback/credentials \
    -H "Content-Type: application/x-www-form-urlencoded" \
    --data-urlencode "csrfToken=$csrf" --data-urlencode "identifier=$email" \
    --data-urlencode "password=$pass" --data-urlencode "json=true"; }
login $JAR_C rahul@example.com customer123
login $JAR_A admin@nightcorner.in admin123

# Force-open for testing (it's morning) — via admin settings API
curl -s -b $JAR_A -X PUT $BASE/api/admin/settings -H "Content-Type: application/json" -d '{"forceOpen":true}' >/dev/null

# helper: get product id + stock
pid() { node -e "const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.product.findUnique({where:{slug:'$1'}}).then(x=>{console.log(x.id);p.\$disconnect()})"; }
stock_of() { node -e "const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.product.findUnique({where:{slug:'$1'}}).then(x=>{console.log(x.stock);p.\$disconnect()})"; }

MAGGI=$(pid maggi); DAIRY=$(pid dairy-milk); COKE=$(pid coca-cola); BROWNIE=$(pid brownie); WATER=$(pid mineral-water-500-ml)

############################################################
section "6. CART SYNC API (server-side price/stock)"
############################################################
SYNC=$(curl -s -b $JAR_C -X POST $BASE/api/cart/sync -H "Content-Type: application/json" \
  -d "{\"items\":[{\"productId\":\"$MAGGI\",\"quantity\":2},{\"productId\":\"$DAIRY\",\"quantity\":1}]}")
check_contains "Cart sync returns product names" 'Maggi' "$SYNC"
check_contains "Cart sync returns server price (14)" '"unitPrice":14' "$SYNC"
check_contains "Cart sync caps to stock (maxStock)" 'maxStock' "$SYNC"

############################################################
section "7. CHECKOUT QUOTE — pricing/distance/tax/coupon (server-side)"
############################################################
# Ensure customer has an in-range address
node -e "
const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();
(async()=>{
  const u=await p.user.findUnique({where:{email:'rahul@example.com'}});
  let a=await p.address.findFirst({where:{userId:u.id}});
  if(!a)a=await p.address.create({data:{userId:u.id,fullName:'Rahul Sharma',mobile:'9999911111',house:'Flat 301',street:'MG Road',area:'Vijay Nagar',city:'Indore',state:'Madhya Pradesh',pincode:'452010',lat:22.758,lng:75.892,isDefault:true}});
  p.\$disconnect();
})();"
AID=$(node -e "const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.address.findFirst().then(a=>{console.log(a.id);p.\$disconnect()})")

# In-range quote (Vijay Nagar ~0.7km -> ₹20 slab)
Q1=$(curl -s -b $JAR_C -X POST $BASE/api/checkout/quote -H "Content-Type: application/json" \
  -d "{\"items\":[{\"productId\":\"$MAGGI\",\"quantity\":5}],\"lat\":22.758,\"lng\":75.892}")
check_contains "Quote computes subtotal" '"subtotal":70' "$Q1"
check_contains "Quote computes delivery (0-2km=₹20)" '"deliveryCharge":20' "$Q1"
check_contains "Quote computes tax (5%)" '"tax":3.5' "$Q1"
check_contains "Quote total correct" '"total":93.5' "$Q1"
check_contains "Quote distance in KM" '"distanceKm"' "$Q1"
check_contains "Quote returns min-order flag" '"minOrderMet":false' "$Q1"

# Outside 10 KM
Q2=$(curl -s -b $JAR_C -X POST $BASE/api/checkout/quote -H "Content-Type: application/json" \
  -d "{\"items\":[{\"productId\":\"$WATER\",\"quantity\":5}],\"lat\":23.2599,\"lng\":77.4126}")
check_contains "Outside 10KM rejected" "only within 10 KM" "$Q2"

# Over-stock rejected
Q3=$(curl -s -b $JAR_C -X POST $BASE/api/checkout/quote -H "Content-Type: application/json" \
  -d "{\"items\":[{\"productId\":\"$MAGGI\",\"quantity\":6}],\"lat\":22.758,\"lng\":75.892}")
check_contains "Over-stock rejected" "Only" "$Q3"

# Coupon NIGHT10 (10% over ₹199)
Q4=$(curl -s -b $JAR_C -X POST $BASE/api/checkout/quote -H "Content-Type: application/json" \
  -d "{\"items\":[{\"productId\":\"$BROWNIE\",\"quantity\":4},{\"productId\":\"$COKE\",\"quantity\":2}],\"lat\":22.758,\"lng\":75.892,\"couponCode\":\"NIGHT10\"}")
check_contains "NIGHT10 applies discount" '"discount"' "$Q4"
check_contains "NIGHT10 coupon code recorded" '"couponCode":"NIGHT10"' "$Q4"

# Free delivery coupon
Q5=$(curl -s -b $JAR_C -X POST $BASE/api/checkout/quote -H "Content-Type: application/json" \
  -d "{\"items\":[{\"productId\":\"$MAGGI\",\"quantity\":5}],\"lat\":22.758,\"lng\":75.892,\"couponCode\":\"FREESHIP\"}")
check_contains "FREESHIP gives free delivery" '"deliveryCharge":0' "$Q5"

# Below minimum order
Q6=$(curl -s -b $JAR_C -X POST $BASE/api/checkout/quote -H "Content-Type: application/json" \
  -d "{\"items\":[{\"productId\":\"$MAGGI\",\"quantity\":2}],\"lat\":22.758,\"lng\":75.892}")
check_contains "Below min-order flagged" '"minOrderMet":false' "$Q6"

# Distance slab check ~5-7km (₹40)
Q7=$(curl -s -b $JAR_C -X POST $BASE/api/checkout/quote -H "Content-Type: application/json" \
  -d "{\"items\":[{\"productId\":\"$MAGGI\",\"quantity\":5}],\"lat\":22.798,\"lng\":75.893}")
check_contains "5-7km slab = ₹40" '"deliveryCharge":40' "$Q7"

# Unauthenticated quote rejected
Q8=$(curl -s -o /dev/null -w "%{http_code}" -X POST $BASE/api/checkout/quote -H "Content-Type: application/json" \
  -d "{\"items\":[{\"productId\":\"$MAGGI\",\"quantity\":1}],\"lat\":22.758,\"lng\":75.892}")
check "Quote requires auth" 401 $Q8

############################################################
section "8. ORDER PLACEMENT + INVENTORY DEDUCTION"
############################################################
MAGGI_STOCK_BEFORE=$(stock_of maggi)
ORDER=$(curl -s -b $JAR_C -X POST $BASE/api/orders -H "Content-Type: application/json" \
  -d "{\"items\":[{\"productId\":\"$BROWNIE\",\"quantity\":2},{\"productId\":\"$DAIRY\",\"quantity\":2}],\"addressId\":\"$AID\",\"paymentMethod\":\"COD\",\"couponCode\":\"NIGHT10\"}")
check_contains "Order created with ID" '"orderId"' "$ORDER"
check_contains "Order number NC-2026- format" '"orderNumber":"NC-2026-' "$ORDER"
OID=$(echo "$ORDER" | python3 -c "import sys,json;print(json.load(sys.stdin)['orderId'])")
ONUM=$(echo "$ORDER" | python3 -c "import sys,json;print(json.load(sys.stdin)['orderNumber'])")
check "First order is NC-2026-00001" "NC-2026-00001" "$ONUM"

# Verify DB: order + items
ODB=$(node -e "const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();(async()=>{const o=await p.order.findUnique({where:{id:'$OID'},include:{items:true}});console.log(JSON.stringify({total:o.total,status:o.status,n:o.items.length}));p.\$disconnect()})()")
check_contains "Order persisted with status PLACED" '"status":"PLACED"' "$ODB"
check_contains "Order has 2 line items" '"n":2' "$ODB"

# Brownie stock: 5 -> 3 after 2 sold
BROWNIE_AFTER=$(stock_of brownie)
check "Brownie stock deducted (5->3)" 3 $BROWNIE_AFTER

# Inventory transaction recorded
INV=$(node -e "const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();(async()=>{const n=await p.inventoryTx.count({where:{reason:'ORDER'}});console.log(n);p.\$disconnect()})()")
check "Inventory transactions recorded" 2 $INV   # 2 products, both order tx + coupon? Actually 2 lines

# Customer notification created
NOTIF=$(node -e "const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();(async()=>{const n=await p.notification.count({where:{userId:(await p.user.findUnique({where:{email:'rahul@example.com'}})).id}});console.log(n);p.\$disconnect()})()")
check "Customer notified of order" 1 $NOTIF

# Invoice accessible
INVCODE=$(curl -s -b $JAR_C -o /dev/null -w "%{http_code}" $BASE/api/orders/$OID/invoice)
check "Invoice downloadable (200)" 200 $INVCODE
INVBODY=$(curl -s -b $JAR_C $BASE/api/orders/$OID/invoice)
check_contains "Invoice has order number" "$ONUM" "$INVBODY"
check_contains "Invoice has brand name" "NIGHT CORNER" "$INVBODY"
check_contains "Invoice has Thank you" "Thank you for ordering" "$INVBODY"

# Order cannot be placed with another user's address
OTHER_AID=$(node -e "const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();(async()=>{const u=await p.user.create({data:{email:'other@x.com',name:'Other',passwordHash:'x',role:'CUSTOMER'}});const a=await p.address.create({data:{userId:u.id,fullName:'X',mobile:'9999999999',house:'h',street:'s',area:'a',city:'c',state:'MP',pincode:'452010',lat:22.7,lng:75.8}});console.log(a.id);p.\$disconnect()})()")
ORDBAD=$(curl -s -b $JAR_C -o /dev/null -w "%{http_code}" -X POST $BASE/api/orders -H "Content-Type: application/json" \
  -d "{\"items\":[{\"productId\":\"$MAGGI\",\"quantity\":5}],\"addressId\":\"$OTHER_AID\",\"paymentMethod\":\"COD\"}")
check "Cannot use another user's address" 400 $ORDBAD

echo ""; echo -e "${GREEN}Batch 2: $PASS passed, $FAIL failed${NC}"
echo "$PASS $FAIL" > /tmp/nc-batch2.txt
