#!/bin/bash
# Comprehensive Night Corner feature test
BASE=http://localhost:3000
PASS=0; FAIL=0
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'

check() {
  local desc="$1"; local expected="$2"; local actual="$3"
  if [ "$expected" = "$actual" ]; then
    echo -e "${GREEN}  ✅ PASS${NC} $desc"
    PASS=$((PASS+1))
  else
    echo -e "${RED}  ❌ FAIL${NC} $desc (expected $expected, got $actual)"
    FAIL=$((FAIL+1))
  fi
}
check_contains() {
  local desc="$1"; local needle="$2"; local body="$3"
  if echo "$body" | grep -q "$needle"; then
    echo -e "${GREEN}  ✅ PASS${NC} $desc"
    PASS=$((PASS+1))
  else
    echo -e "${RED}  ❌ FAIL${NC} $desc — missing '$needle'"
    FAIL=$((FAIL+1))
  fi
}
section() { echo -e "\n${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"; echo "  $1"; echo -e "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"; }
http() { curl -s -o /tmp/nc-body.txt -w "%{http_code}" "$@"; BODY=$(cat /tmp/nc-body.txt); }

JAR_C=/tmp/nc-customer.txt; JAR_A=/tmp/nc-admin.txt
rm -f $JAR_C $JAR_A

login() {
  local jar=$1 email=$2 pass=$3
  local csrf=$(curl -s -c $jar $BASE/api/auth/csrf | python3 -c "import sys,json;print(json.load(sys.stdin)['csrfToken'])")
  curl -s -b $jar -c $jar -o /dev/null -X POST $BASE/api/auth/callback/credentials \
    -H "Content-Type: application/x-www-form-urlencoded" \
    --data-urlencode "csrfToken=$csrf" --data-urlencode "identifier=$email" \
    --data-urlencode "password=$pass" --data-urlencode "json=true"
}

############################################################
section "1. STOREFRONT PAGES (HTTP status)"
############################################################
for p in / /shop /categories /cart /checkout /login /signup /track-order /faq /offline; do
  code=$(curl -s -o /dev/null -w "%{http_code}" $BASE$p)
  check "GET $p" 200 $code
done

# Category & product detail pages
for c in bakery-desserts chips-namkeen chocolates-sweets biscuits-cookies instant-food drinks-energy; do
  code=$(curl -s -o /dev/null -w "%{http_code}" $BASE/category/$c)
  check "GET /category/$c" 200 $code
done
for slug in maggi dairy-milk coca-cola lays brownie kitkat oreo veg-puff; do
  code=$(curl -s -o /dev/null -w "%{http_code}" $BASE/shop/$slug)
  check "GET /shop/$slug" 200 $code
done

# 404 page
code=$(curl -s -o /dev/null -w "%{http_code}" $BASE/shop/nonexistent-product-xyz)
check "GET unknown product -> 404" 404 $code

############################################################
section "2. STATIC ASSETS / BRANDING / PWA"
############################################################
for f in /logo.svg /logo-icon.svg /favicon.svg /manifest.webmanifest /sw.js /robots.txt /sitemap.xml; do
  code=$(curl -s -o /dev/null -w "%{http_code}" $BASE$f)
  check "GET $f" 200 $code
done
# 53 product + 6 category images
NPROD=$(ls public/images/products | wc -l)
check "53 product images generated" 53 $NPROD
NCAT=$(ls public/images/categories | wc -l)
check "6 category images generated" 6 $NCAT

############################################################
section "3. BUSINESS HOURS / OPEN STATUS API"
############################################################
http $BASE/api/open-status
check "Open-status API returns 200" 200 $?
check_contains "Response has isOpen field" '"isOpen"' "$BODY"
check_contains "Response has opensAt (10 PM window)" '"opensAt"' "$BODY"
check_contains "Reports closed now (morning test)" '"isOpen":false' "$BODY"

############################################################
section "4. SEARCH API + AUTOCOMPLETE"
############################################################
http "$BASE/api/search?q=maggi"
check_contains "Search finds Maggi" '"slug":"maggi"' "$BODY"
http "$BASE/api/search?q=dairy"
check_contains "Search finds Dairy Milk" '"slug":"dairy-milk"' "$BODY"
http "$BASE/api/search?q=chocolate"
check_contains "Search returns multiple" 'products' "$BODY"
# SKU search
http "$BASE/api/search?q=NC-INS"
check_contains "SKU search works" 'products' "$BODY"

############################################################
section "5. AUTHENTICATION"
############################################################
# Signup new customer
SIGNUP=$(curl -s -X POST $BASE/api/auth/signup -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"testuser@example.com","mobile":"9876543210","password":"test123"}')
check_contains "Signup creates account" '"id"' "$SIGNUP"
# Duplicate signup
DUP=$(curl -s -o /dev/null -w "%{http_code}" -X POST $BASE/api/auth/signup -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"testuser@example.com","mobile":"9876543210","password":"test123"}')
check "Duplicate signup rejected" 409 $DUP
# Invalid signup
BAD=$(curl -s -o /dev/null -w "%{http_code}" -X POST $BASE/api/auth/signup -H "Content-Type: application/json" \
  -d '{"name":"x","email":"bad","mobile":"123","password":"1"}')
check "Invalid signup rejected" 400 $BAD

# Login customer
login $JAR_C rahul@example.com customer123
SESS=$(curl -s -b $JAR_C $BASE/api/auth/session)
check_contains "Customer login session established" '"role":"CUSTOMER"' "$SESS"
check_contains "Customer name present" 'Rahul Sharma' "$SESS"

# Login by mobile number
JAR_M=/tmp/nc-mobile.txt; rm -f $JAR_M
MCSRF=$(curl -s -c $JAR_M $BASE/api/auth/csrf | python3 -c "import sys,json;print(json.load(sys.stdin)['csrfToken'])")
curl -s -b $JAR_M -c $JAR_M -o /dev/null -X POST $BASE/api/auth/callback/credentials \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "csrfToken=$MCSRF" --data-urlencode "identifier=9999911111" \
  --data-urlencode "password=customer123" --data-urlencode "json=true"
MSESS=$(curl -s -b $JAR_M $BASE/api/auth/session)
check_contains "Login by mobile number works" '"role":"CUSTOMER"' "$MSESS"

# Wrong password
JAR_B=/tmp/nc-bad.txt; rm -f $JAR_B
BCSRF=$(curl -s -c $JAR_B $BASE/api/auth/csrf | python3 -c "import sys,json;print(json.load(sys.stdin)['csrfToken'])")
curl -s -b $JAR_B -c $JAR_B -o /dev/null -X POST $BASE/api/auth/callback/credentials \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "csrfToken=$BCSRF" --data-urlencode "identifier=rahul@example.com" \
  --data-urlencode "password=wrongpass" --data-urlencode "json=true"
BSESS=$(curl -s -b $JAR_B $BASE/api/auth/session)
check "Wrong password gives no session" "{}" "$BSESS"

# Admin login
login $JAR_A admin@nightcorner.in admin123
ASESS=$(curl -s -b $JAR_A $BASE/api/auth/session)
check_contains "Admin login session" '"role":"ADMIN"' "$ASESS"

# Admin route protection (customer redirected)
CODE=$(curl -s -b $JAR_C -o /dev/null -w "%{http_code}" $BASE/admin)
check "Customer blocked from /admin (307)" 307 $CODE
CODE=$(curl -s -o /dev/null -w "%{http_code}" $BASE/admin)
check "Anonymous blocked from /admin (307)" 307 $CODE

echo ""
echo -e "${GREEN}Results so far: $PASS passed, $FAIL failed${NC}"
echo "PASS_COUNT=$PASS FAIL_COUNT=$FAIL" > /tmp/nc-results.txt
