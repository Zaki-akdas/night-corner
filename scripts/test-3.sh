#!/bin/bash
BASE=http://localhost:3000
PASS=0; FAIL=0
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
check() { if [ "$2" = "$3" ]; then echo -e "${GREEN}  ✅ PASS${NC} $1"; PASS=$((PASS+1)); else echo -e "${RED}  ❌ FAIL${NC} $1 (expected $2, got $3)"; FAIL=$((FAIL+1)); fi; }
check_contains() { if echo "$3" | grep -q "$2"; then echo -e "${GREEN}  ✅ PASS${NC} $1"; PASS=$((PASS+1)); else echo -e "${RED}  ❌ FAIL${NC} $1 — missing '$2'"; FAIL=$((FAIL+1)); fi; }
section() { echo -e "\n${YELLOW}━━ $1 ━━${NC}"; }
JAR_A=/tmp/nc-admin.txt; JAR_C=/tmp/nc-customer.txt
login() { local jar=$1 email=$2 pass=$3
  local csrf=$(curl -s -c $jar $BASE/api/auth/csrf | python3 -c "import sys,json;print(json.load(sys.stdin)['csrfToken'])")
  curl -s -b $jar -c $jar -o /dev/null -X POST $BASE/api/auth/callback/credentials \
    -H "Content-Type: application/x-www-form-urlencoded" \
    --data-urlencode "csrfToken=$csrf" --data-urlencode "identifier=$email" \
    --data-urlencode "password=$pass" --data-urlencode "json=true"; }
login $JAR_A admin@nightcorner.in admin123
login $JAR_C rahul@example.com customer123

pid() { node -e "const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.product.findUnique({where:{slug:'$1'}}).then(x=>{console.log(x.id);p.\$disconnect()})"; }
MAGGI=$(pid maggi); KITKAT=$(pid kitkat)

# Get a customer order id (create one for workflow testing)
node -e "
const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();
(async()=>{
  const s=await p.settings.findUnique({where:{key:'app_settings'}});const v=JSON.parse(s.value);v.forceOpen=true;
  await p.settings.update({where:{key:'app_settings'},data:{value:JSON.stringify(v)}});
  p.\$disconnect();
})();"
AID=$(node -e "const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.address.findFirst().then(a=>{console.log(a.id);p.\$disconnect()})")
COKE=$(pid coca-cola)
ORD=$(curl -s -b $JAR_C -X POST $BASE/api/orders -H "Content-Type: application/json" \
  -d "{\"items\":[{\"productId\":\"$MAGGI\",\"quantity\":4},{\"productId\":\"$COKE\",\"quantity\":2}],\"addressId\":\"$AID\",\"paymentMethod\":\"UPI\"}")
OID=$(echo "$ORD" | python3 -c "import sys,json;print(json.load(sys.stdin)['orderId'])")
ONUM=$(echo "$ORD" | python3 -c "import sys,json;print(json.load(sys.stdin)['orderNumber'])")

############################################################
section "9. ORDER TRACKING (guest + account)"
############################################################
TRK=$(curl -s "$BASE/api/orders/track?orderNumber=$ONUM")
check_contains "Guest track by order number finds order" "\"orderNumber\":\"$ONUM\"" "$TRK"
check_contains "Track returns status" "\"status\":\"PLACED\"" "$TRK"
BAD=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/orders/track?orderNumber=NC-2026-99999")
check "Track unknown order -> 404" 404 $BAD

CODE=$(curl -s -b $JAR_C -o /dev/null -w "%{http_code}" $BASE/account/orders/$OID)
check "Customer can view own order page" 200 $CODE
ACCOUNT_ORDERS=$(curl -s -b $JAR_C -o /dev/null -w "%{http_code}" $BASE/account/orders)
check "Customer orders list renders" 200 $ACCOUNT_ORDERS

############################################################
section "10. ORDER STATUS WORKFLOW (admin)"
############################################################
for ST in CONFIRMED PREPARING PACKED OUT_FOR_DELIVERY; do
  R=$(curl -s -b $JAR_A -o /dev/null -w "%{http_code}" -X PATCH $BASE/api/admin/orders/$OID/status \
    -H "Content-Type: application/json" -d "{\"status\":\"$ST\"}")
  check "Admin can set status $ST" 200 $R
done
# verify progression in DB
CUR=$(node -e "const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.order.findUnique({where:{id:'$OID'}}).then(o=>{console.log(o.status);p.\$disconnect()})")
check "Order progressed to OUT_FOR_DELIVERY" "OUT_FOR_DELIVERY" "$CUR"

# Status update forbidden for customer
FORBID=$(curl -s -b $JAR_C -o /dev/null -w "%{http_code}" -X PATCH $BASE/api/admin/orders/$OID/status \
  -H "Content-Type: application/json" -d '{"status":"DELIVERED"}')
check "Customer cannot change order status (redirect)" 307 $FORBID

# Mark delivered
curl -s -b $JAR_A -o /dev/null -X PATCH $BASE/api/admin/orders/$OID/status \
  -H "Content-Type: application/json" -d '{"status":"DELIVERED"}'
DEL=$(node -e "const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.order.findUnique({where:{id:'$OID'}}).then(o=>{console.log(o.status);p.\$disconnect()})")
check "Order marked DELIVERED" "DELIVERED" "$DEL"

# Admin can view order detail + invoice
ADMIN_OD=$(curl -s -b $JAR_A -o /dev/null -w "%{http_code}" $BASE/admin/orders/$OID)
check "Admin order detail page renders" 200 $ADMIN_OD
ADMIN_INV=$(curl -s -b $JAR_A -o /dev/null -w "%{http_code}" $BASE/api/orders/$OID/invoice)
check "Admin can download any invoice" 200 $ADMIN_INV

############################################################
section "11. CANCELLATION RESTORES STOCK"
############################################################
# Create another order, then cancel, verify stock restored
ORD2=$(curl -s -b $JAR_C -X POST $BASE/api/orders -H "Content-Type: application/json" \
  -d "{\"items\":[{\"productId\":\"$KITKAT\",\"quantity\":4}],\"addressId\":\"$AID\",\"paymentMethod\":\"COD\"}")
OID2=$(echo "$ORD2" | python3 -c "import sys,json;print(json.load(sys.stdin)['orderId'])")
KITKAT_BEFORE=$(node -e "const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.product.findUnique({where:{slug:'kitkat'}}).then(x=>{console.log(x.stock);p.\$disconnect()})")
curl -s -b $JAR_A -o /dev/null -X PATCH $BASE/api/admin/orders/$OID2/status -H "Content-Type: application/json" -d '{"status":"CANCELLED"}'
KITKAT_AFTER=$(node -e "const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.product.findUnique({where:{slug:'kitkat'}}).then(x=>{console.log(x.stock);p.\$disconnect()})")
check "Cancellation restores stock ($KITKAT_BEFORE -> $KITKAT_AFTER)" "$(($KITKAT_BEFORE + 2))" "$KITKAT_AFTER"

############################################################
section "12. ADMIN PAGES RENDER"
############################################################
for p in /admin /admin/orders /admin/products /admin/categories /admin/inventory /admin/customers /admin/coupons /admin/delivery /admin/analytics /admin/settings /admin/notifications /admin/reviews /admin/users /admin/activity; do
  CODE=$(curl -s -b $JAR_A -o /dev/null -w "%{http_code}" $BASE$p)
  check "Admin $p (200)" 200 $CODE
done

echo ""; echo -e "${GREEN}Batch 3: $PASS passed, $FAIL failed${NC}"
echo "$PASS $FAIL" > /tmp/nc-batch3.txt
