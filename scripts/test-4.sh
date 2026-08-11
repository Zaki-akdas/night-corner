#!/bin/bash
BASE=http://localhost:3000
PASS=0; FAIL=0
GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; NC='\033[0m'
ok() { echo -e "${GREEN}  ✅ PASS${NC} $1"; PASS=$((PASS+1)); }
no() { echo -e "${RED}  ❌ FAIL${NC} $1"; FAIL=$((FAIL+1)); }
assert() { [ "$2" = "$3" ] && ok "$1" || no "$1 (expected $2 got $3)"; }
contains() { echo "$3" | grep -q "$2" && ok "$1" || no "$1 — missing $2"; }
section() { echo -e "\n${YELLOW}━━ $1 ━━${NC}"; }
JAR_A=/tmp/nc-admin.txt; JAR_C=/tmp/nc-customer.txt
node_run() { node -e "$1"; }

section "13. ADDRESS MANAGEMENT"
RESP=$(curl -s -b $JAR_C -X POST $BASE/api/account/addresses -H "Content-Type: application/json" \
  -d '{"fullName":"Rahul S","mobile":"9999911111","house":"H-12","street":"Race Course Rd","area":"Palasia","city":"Indore","state":"Madhya Pradesh","pincode":"452001","lat":22.72,"lng":75.88}')
contains "Create address returns area" "Palasia" "$RESP"
NEW_ADDR=$(echo "$RESP" | python3 -c "import sys,json;print(json.load(sys.stdin)['id'])")
CODE=$(curl -s -o /dev/null -w "%{http_code}" -b $JAR_C -X POST $BASE/api/account/addresses -H "Content-Type: application/json" -d '{"fullName":"X","mobile":"9999911111","house":"h","street":"s","area":"a","city":"c","state":"MP","pincode":"123"}')
assert "Invalid pincode rejected" 400 $CODE
LIST=$(curl -s -b $JAR_C $BASE/api/account/addresses)
contains "Address list has new id" "$NEW_ADDR" "$LIST"
CODE=$(curl -s -o /dev/null -w "%{http_code}" -b $JAR_C -X DELETE $BASE/api/account/addresses/$NEW_ADDR)
assert "Delete address" 200 $CODE
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST $BASE/api/account/addresses -H "Content-Type: application/json" -d '{}')
assert "Address create requires auth" 401 $CODE

section "14. WISHLIST"
assert "Wishlist endpoint" 200 $(curl -s -o /dev/null -w "%{http_code}" -b $JAR_C $BASE/api/account/wishlist)
assert "Wishlist page renders" 200 $(curl -s -o /dev/null -w "%{http_code}" -b $JAR_C $BASE/account/wishlist)

section "15. PROFILE UPDATE"
CODE=$(curl -s -o /dev/null -w "%{http_code}" -b $JAR_C -X PATCH $BASE/api/account/profile -H "Content-Type: application/json" -d '{"name":"Rahul Sharma Jr"}')
assert "Profile update" 200 $CODE
NEWNAME=$(node_run "const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.user.findUnique({where:{email:'rahul@example.com'}}).then(x=>{console.log(x.name);p.\$disconnect()})")
assert "Profile name persisted" "Rahul Sharma Jr" "$NEWNAME"
curl -s -b $JAR_C -X PATCH $BASE/api/account/profile -H "Content-Type: application/json" -d '{"name":"Rahul Sharma"}' >/dev/null

section "16. ADMIN PRODUCT CREATE/UPDATE/DELETE"
BAKERY=$(node_run "const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.category.findFirst({where:{slug:'bakery-desserts'}}).then(x=>{console.log(x.id);p.\$disconnect()})")
RESP=$(curl -s -b $JAR_A -X POST $BASE/api/admin/products -H "Content-Type: application/json" \
  -d "{\"name\":\"Test Midnight Cookie\",\"description\":\"A test cookie for admin e2e testing\",\"shortDesc\":\"test\",\"categoryId\":\"$BAKERY\",\"price\":45,\"mrp\":50,\"stock\":7,\"unit\":\"1 pc\",\"sku\":\"NC-TST-002\",\"isVeg\":true}")
contains "Create product returns name" "Test Midnight Cookie" "$RESP"
NEWPID=$(echo "$RESP" | python3 -c "import sys,json;print(json.load(sys.stdin)['id'])")
NEWSLUG=$(echo "$RESP" | python3 -c "import sys,json;print(json.load(sys.stdin)['slug'])")
assert "New product page renders" 200 $(curl -s -o /dev/null -w "%{http_code}" $BASE/shop/$NEWSLUG)
CODE=$(curl -s -o /dev/null -w "%{http_code}" -b $JAR_A -X PATCH $BASE/api/admin/products/$NEWPID -H "Content-Type: application/json" -d '{"price":40,"bestSeller":true}')
assert "Update product" 200 $CODE
PRICE=$(node_run "const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.product.findUnique({where:{id:'$NEWPID'}}).then(x=>{console.log(x.price);p.\$disconnect()})")
assert "Price updated to 40" 40 $PRICE
CODE=$(curl -s -o /dev/null -w "%{http_code}" -b $JAR_C -X POST $BASE/api/admin/products -H "Content-Type: application/json" -d '{}')
assert "Customer blocked from product create" 307 $CODE
CODE=$(curl -s -o /dev/null -w "%{http_code}" -b $JAR_A -X DELETE $BASE/api/admin/products/$NEWPID)
assert "Soft-delete product" 200 $CODE
HIDDEN=$(node_run "const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.product.findUnique({where:{id:'$NEWPID'}}).then(x=>{console.log(x.active);p.\$disconnect()})")
assert "Product marked inactive" "false" "$HIDDEN"

section "17. INVENTORY ADJUSTMENT"
MAGGI=$(node_run "const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.product.findUnique({where:{slug:'maggi'}}).then(x=>{console.log(x.id);p.\$disconnect()})")
BEFORE=$(node_run "const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.product.findUnique({where:{slug:'maggi'}}).then(x=>{console.log(x.stock);p.\$disconnect()})")
curl -s -b $JAR_A -X POST $BASE/api/admin/inventory/$MAGGI -H "Content-Type: application/json" -d '{"delta":3,"reason":"RESTOCK","note":"e2e"}' >/dev/null
AFTER=$(node_run "const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.product.findUnique({where:{slug:'maggi'}}).then(x=>{console.log(x.stock);p.\$disconnect()})")
assert "Restock +3 works" "$((BEFORE+3))" "$AFTER"
TXN=$(node_run "const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.inventoryTx.count({where:{productId:'$MAGGI',reason:'RESTOCK'}}).then(n=>{console.log(n);p.\$disconnect()})")
assert "Inventory txn recorded" 1 $TXN

section "18. CATEGORY MANAGEMENT"
RESP=$(curl -s -b $JAR_A -X POST $BASE/api/admin/categories -H "Content-Type: application/json" -d '{"name":"Test Night Specials","description":"e2e"}')
contains "Category name returned" "Test Night Specials" "$RESP"
NEWCAT=$(echo "$RESP" | python3 -c "import sys,json;print(json.load(sys.stdin)['id'])")
curl -s -b $JAR_A -X PATCH $BASE/api/admin/categories/$NEWCAT -H "Content-Type: application/json" -d '{"active":false}' >/dev/null
CATACTIVE=$(node_run "const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.category.findUnique({where:{id:'$NEWCAT'}}).then(x=>{console.log(x.active);p.\$disconnect()})")
assert "Category hidden" "false" "$CATACTIVE"
curl -s -b $JAR_A -X DELETE $BASE/api/admin/categories/$NEWCAT >/dev/null
GONE=$(node_run "const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.category.findUnique({where:{id:'$NEWCAT'}}).then(x=>{console.log(x===null);p.\$disconnect()})")
assert "Category deleted" "true" "$GONE"

section "19. COUPON MANAGEMENT"
RESP=$(curl -s -b $JAR_A -X POST $BASE/api/admin/coupons -H "Content-Type: application/json" -d '{"code":"TEST50","type":"PERCENT","value":50,"minOrder":200,"maxDiscount":100}')
contains "Coupon code returned" "TEST50" "$RESP"
COUPID=$(echo "$RESP" | python3 -c "import sys,json;print(json.load(sys.stdin)['id'])")
curl -s -b $JAR_A -X PATCH $BASE/api/admin/coupons/$COUPID -H "Content-Type: application/json" -d '{"active":false}' >/dev/null
CAC=$(node_run "const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.coupon.findUnique({where:{id:'$COUPID'}}).then(x=>{console.log(x.active);p.\$disconnect()})")
assert "Coupon deactivated" "false" "$CAC"
curl -s -b $JAR_A -X DELETE $BASE/api/admin/coupons/$COUPID >/dev/null

section "20. SETTINGS / HOURS / DELIVERY"
CODE=$(curl -s -o /dev/null -w "%{http_code}" -b $JAR_A -X PUT $BASE/api/admin/settings -H "Content-Type: application/json" -d '{"openTime":"22:00","closeTime":"06:00","maxRadiusKm":10,"minOrderAmount":99,"freeDeliveryAbove":499}')
assert "Settings update" 200 $CODE
TAX=$(curl -s $BASE/api/settings/public | python3 -c "import sys,json;print(json.load(sys.stdin)['taxPercent'])")
assert "Public settings expose tax" 5 $TAX
curl -s -b $JAR_A -X PUT $BASE/api/admin/settings -H "Content-Type: application/json" -d '{"forceOpen":false}' >/dev/null
FORCE=$(node_run "const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();(async()=>{const s=await p.settings.findUnique({where:{key:'app_settings'}});console.log(JSON.parse(s.value).forceOpen);p.\$disconnect()})()")
assert "Force-open disabled" "false" "$FORCE"

section "21. NOTIFICATIONS & ACTIVITY LOG"
NOTIF=$(curl -s -b $JAR_A "$BASE/api/admin/notifications?unread=1")
contains "Notification count works" "count" "$NOTIF"
assert "Activity page renders" 200 $(curl -s -o /dev/null -w "%{http_code}" -b $JAR_A $BASE/admin/activity)
LOGN=$(node_run "const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.activityLog.count().then(n=>{console.log(n>0);p.\$disconnect()})")
assert "Activity logs recorded" "true" "$LOGN"

section "22. ADMIN USER ROLES"
node_run "const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();(async()=>{await p.user.upsert({where:{email:'staff@nightcorner.in'},update:{},create:{email:'staff@nightcorner.in',name:'Staff',passwordHash:'x',role:'STAFF'}});p.\$disconnect();})()"
STAFFID=$(node_run "const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.user.findUnique({where:{email:'staff@nightcorner.in'}}).then(x=>{console.log(x.id);p.\$disconnect()})")
curl -s -b $JAR_A -X PATCH $BASE/api/admin/users/$STAFFID -H "Content-Type: application/json" -d '{"role":"ADMIN"}' >/dev/null
ROLE=$(node_run "const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.user.findUnique({where:{id:'$STAFFID'}}).then(x=>{console.log(x.role);p.\$disconnect()})")
assert "Admin changes user role" "ADMIN" "$ROLE"

section "23. SEO / PUBLIC SETTINGS"
PUB=$(curl -s $BASE/api/settings/public)
contains "Public has codEnabled" "codEnabled" "$PUB"
contains "Public has whatsappNumber" "whatsappNumber" "$PUB"
contains "robots disallows admin" "Disallow: /admin" "$(curl -s $BASE/robots.txt)"
SM=$(curl -s $BASE/sitemap.xml)
contains "sitemap lists maggi" "/shop/maggi" "$SM"
contains "sitemap lists category" "/category/bakery-desserts" "$SM"

section "24. INVOICE CONTENT"
OID=$(node_run "const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.order.findFirst({where:{status:'DELIVERED'}}).then(o=>{console.log(o?.id||'');p.\$disconnect()})")
INV=$(curl -s -b $JAR_C $BASE/api/orders/$OID/invoice)
contains "Invoice Grand Total" "Grand Total" "$INV"
contains "Invoice Payment" "Payment" "$INV"
contains "Invoice slogan" "Your Night. Your Essentials" "$INV"

echo ""; echo -e "${GREEN}Batch 4: $PASS passed, $FAIL failed${NC}"
echo "$PASS $FAIL" > /tmp/nc-batch4.txt
