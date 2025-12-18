#!/bin/bash

# ============================================
# API Testing Script
# Prueba todos los endpoints y genera reporte
# ============================================

# Colores para output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Variables
API_URL="http://localhost:3000"
REPORT_FILE="test-report-$(date +%Y%m%d-%H%M%S).txt"
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Tokens (se llenarán después del login)
ACCESS_TOKEN=""
REFRESH_TOKEN=""
USER_ID=""

# ============================================
# Funciones auxiliares
# ============================================

log_test() {
    local test_name="$1"
    local status="$2"
    local details="$3"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    if [ "$status" == "PASS" ]; then
        PASSED_TESTS=$((PASSED_TESTS + 1))
        echo -e "${GREEN}✓${NC} $test_name"
        echo "[PASS] $test_name" >> "$REPORT_FILE"
    else
        FAILED_TESTS=$((FAILED_TESTS + 1))
        echo -e "${RED}✗${NC} $test_name"
        echo "[FAIL] $test_name" >> "$REPORT_FILE"
    fi
    
    if [ -n "$details" ]; then
        echo "  Details: $details" >> "$REPORT_FILE"
    fi
    echo "" >> "$REPORT_FILE"
}

test_endpoint() {
    local method="$1"
    local endpoint="$2"
    local data="$3"
    local headers="$4"
    local expected_status="$5"
    
    if [ -n "$headers" ]; then
        response=$(curl -s -w "\n%{http_code}" -X "$method" "$API_URL$endpoint" \
            -H "Content-Type: application/json" \
            -H "$headers" \
            -d "$data" 2>&1)
    else
        response=$(curl -s -w "\n%{http_code}" -X "$method" "$API_URL$endpoint" \
            -H "Content-Type: application/json" \
            -d "$data" 2>&1)
    fi
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" == "$expected_status" ]; then
        echo "PASS|$body"
    else
        echo "FAIL|Expected $expected_status, got $http_code|$body"
    fi
}

# ============================================
# Inicio del reporte
# ============================================

echo "============================================" | tee "$REPORT_FILE"
echo "API Testing Report" | tee -a "$REPORT_FILE"
echo "Date: $(date)" | tee -a "$REPORT_FILE"
echo "API URL: $API_URL" | tee -a "$REPORT_FILE"
echo "============================================" | tee -a "$REPORT_FILE"
echo "" | tee -a "$REPORT_FILE"

# ============================================
# 1. Health Checks
# ============================================

echo -e "${BLUE}[1/7] Testing Health Checks...${NC}"
echo "=== HEALTH CHECKS ===" >> "$REPORT_FILE"

# Test 1.1: Health endpoint
result=$(test_endpoint "GET" "/health" "" "" "200")
status=$(echo "$result" | cut -d'|' -f1)
body=$(echo "$result" | cut -d'|' -f2-)

if [ "$status" == "PASS" ]; then
    mysql_status=$(echo "$body" | jq -r '.services.mysql.status' 2>/dev/null)
    cache_status=$(echo "$body" | jq -r '.services.cache.status' 2>/dev/null)
    
    if [ "$mysql_status" == "up" ] && [ "$cache_status" == "up" ]; then
        log_test "Health Check - All services UP" "PASS" "MySQL: up, Cache: up"
    else
        log_test "Health Check - Services status" "FAIL" "MySQL: $mysql_status, Cache: $cache_status"
    fi
else
    log_test "Health Check endpoint" "FAIL" "$body"
fi

# Test 1.2: Root endpoint
result=$(test_endpoint "GET" "/" "" "" "200")
status=$(echo "$result" | cut -d'|' -f1)
log_test "Root endpoint" "$status"

# Test 1.3: Metrics endpoint
result=$(test_endpoint "GET" "/metrics" "" "" "200")
status=$(echo "$result" | cut -d'|' -f1)
log_test "Metrics endpoint" "$status"

# ============================================
# 2. Authentication - Login
# ============================================

echo -e "${BLUE}[2/7] Testing Authentication - Login...${NC}"
echo "=== AUTHENTICATION - LOGIN ===" >> "$REPORT_FILE"

# Test 2.1: Login con credenciales correctas
login_data='{"email":"admin@example.com","password":"admin123"}'
result=$(test_endpoint "POST" "/api/v1/auth/login" "$login_data" "" "200")
status=$(echo "$result" | cut -d'|' -f1)
body=$(echo "$result" | cut -d'|' -f2-)

if [ "$status" == "PASS" ]; then
    ACCESS_TOKEN=$(echo "$body" | jq -r '.data.accessToken' 2>/dev/null)
    REFRESH_TOKEN=$(echo "$body" | jq -r '.data.refreshToken' 2>/dev/null)
    USER_ID=$(echo "$body" | jq -r '.data.user.id' 2>/dev/null)
    
    if [ -n "$ACCESS_TOKEN" ] && [ "$ACCESS_TOKEN" != "null" ]; then
        log_test "Login with valid credentials" "PASS" "Token received, User ID: $USER_ID"
    else
        log_test "Login with valid credentials" "FAIL" "No token received"
    fi
else
    log_test "Login with valid credentials" "FAIL" "$body"
fi

# Test 2.2: Login con credenciales incorrectas
wrong_login='{"email":"admin@example.com","password":"wrongpassword"}'
result=$(test_endpoint "POST" "/api/v1/auth/login" "$wrong_login" "" "401")
status=$(echo "$result" | cut -d'|' -f1)
log_test "Login with invalid credentials (should fail)" "$status"

# Test 2.3: Login sin email
no_email='{"password":"admin123"}'
result=$(test_endpoint "POST" "/api/v1/auth/login" "$no_email" "" "400")
status=$(echo "$result" | cut -d'|' -f1)
log_test "Login without email (should fail)" "$status"

# ============================================
# 3. Authentication - Me endpoint
# ============================================

echo -e "${BLUE}[3/7] Testing Authentication - Me endpoint...${NC}"
echo "=== AUTHENTICATION - ME ===" >> "$REPORT_FILE"

if [ -n "$ACCESS_TOKEN" ]; then
    # Test 3.1: Get current user con token válido
    result=$(test_endpoint "GET" "/api/v1/auth/me" "" "Authorization: Bearer $ACCESS_TOKEN" "200")
    status=$(echo "$result" | cut -d'|' -f1)
    body=$(echo "$result" | cut -d'|' -f2-)
    
    if [ "$status" == "PASS" ]; then
        user_email=$(echo "$body" | jq -r '.data.email' 2>/dev/null)
        log_test "Get current user with valid token" "PASS" "Email: $user_email"
    else
        log_test "Get current user with valid token" "FAIL" "$body"
    fi
    
    # Test 3.2: Get current user sin token
    result=$(test_endpoint "GET" "/api/v1/auth/me" "" "" "401")
    status=$(echo "$result" | cut -d'|' -f1)
    log_test "Get current user without token (should fail)" "$status"
    
    # Test 3.3: Get current user con token inválido
    result=$(test_endpoint "GET" "/api/v1/auth/me" "" "Authorization: Bearer invalid_token" "401")
    status=$(echo "$result" | cut -d'|' -f1)
    log_test "Get current user with invalid token (should fail)" "$status"
else
    log_test "Get current user tests" "FAIL" "No access token available"
fi

# ============================================
# 4. Authentication - Register
# ============================================

echo -e "${BLUE}[4/7] Testing Authentication - Register...${NC}"
echo "=== AUTHENTICATION - REGISTER ===" >> "$REPORT_FILE"

# Test 4.1: Register nuevo usuario
random_email="test$(date +%s)@example.com"
register_data="{\"email\":\"$random_email\",\"password\":\"Test123!\",\"name\":\"Test User\"}"
result=$(test_endpoint "POST" "/api/v1/auth/register" "$register_data" "" "201")
status=$(echo "$result" | cut -d'|' -f1)
body=$(echo "$result" | cut -d'|' -f2-)

if [ "$status" == "PASS" ]; then
    new_user_id=$(echo "$body" | jq -r '.data.user.id' 2>/dev/null)
    log_test "Register new user" "PASS" "User created: $random_email, ID: $new_user_id"
else
    log_test "Register new user" "FAIL" "$body"
fi

# Test 4.2: Register con email duplicado
result=$(test_endpoint "POST" "/api/v1/auth/register" "$register_data" "" "400")
status=$(echo "$result" | cut -d'|' -f1)
log_test "Register with duplicate email (should fail)" "$status"

# Test 4.3: Register sin datos requeridos
incomplete_data='{"email":"test@test.com"}'
result=$(test_endpoint "POST" "/api/v1/auth/register" "$incomplete_data" "" "400")
status=$(echo "$result" | cut -d'|' -f1)
log_test "Register without required fields (should fail)" "$status"

# ============================================
# 5. Users - List
# ============================================

echo -e "${BLUE}[5/7] Testing Users - List...${NC}"
echo "=== USERS - LIST ===" >> "$REPORT_FILE"

if [ -n "$ACCESS_TOKEN" ]; then
    # Test 5.1: List users (admin only)
    result=$(test_endpoint "GET" "/api/v1/users?page=1&limit=10" "" "Authorization: Bearer $ACCESS_TOKEN" "200")
    status=$(echo "$result" | cut -d'|' -f1)
    body=$(echo "$result" | cut -d'|' -f2-)
    
    if [ "$status" == "PASS" ]; then
        user_count=$(echo "$body" | jq -r '.data.users | length' 2>/dev/null)
        log_test "List users with admin token" "PASS" "Found $user_count users"
    else
        log_test "List users with admin token" "FAIL" "$body"
    fi
    
    # Test 5.2: List users sin autenticación
    result=$(test_endpoint "GET" "/api/v1/users" "" "" "401")
    status=$(echo "$result" | cut -d'|' -f1)
    log_test "List users without authentication (should fail)" "$status"
else
    log_test "List users tests" "FAIL" "No access token available"
fi

# ============================================
# 6. Users - Get by ID
# ============================================

echo -e "${BLUE}[6/7] Testing Users - Get by ID...${NC}"
echo "=== USERS - GET BY ID ===" >> "$REPORT_FILE"

if [ -n "$ACCESS_TOKEN" ] && [ -n "$USER_ID" ]; then
    # Test 6.1: Get user by ID
    result=$(test_endpoint "GET" "/api/v1/users/$USER_ID" "" "Authorization: Bearer $ACCESS_TOKEN" "200")
    status=$(echo "$result" | cut -d'|' -f1)
    body=$(echo "$result" | cut -d'|' -f2-)
    
    if [ "$status" == "PASS" ]; then
        user_name=$(echo "$body" | jq -r '.data.name' 2>/dev/null)
        log_test "Get user by ID" "PASS" "User: $user_name"
    else
        log_test "Get user by ID" "FAIL" "$body"
    fi
    
    # Test 6.2: Get user con ID inexistente
    result=$(test_endpoint "GET" "/api/v1/users/nonexistent-id" "" "Authorization: Bearer $ACCESS_TOKEN" "404")
    status=$(echo "$result" | cut -d'|' -f1)
    log_test "Get user with non-existent ID (should fail)" "$status"
else
    log_test "Get user by ID tests" "FAIL" "No access token or user ID available"
fi

# ============================================
# 7. Authentication - Refresh Token
# ============================================

echo -e "${BLUE}[7/7] Testing Authentication - Refresh Token...${NC}"
echo "=== AUTHENTICATION - REFRESH TOKEN ===" >> "$REPORT_FILE"

if [ -n "$REFRESH_TOKEN" ]; then
    # Test 7.1: Refresh token válido
    refresh_data="{\"refreshToken\":\"$REFRESH_TOKEN\"}"
    result=$(test_endpoint "POST" "/api/v1/auth/refresh" "$refresh_data" "" "200")
    status=$(echo "$result" | cut -d'|' -f1)
    body=$(echo "$result" | cut -d'|' -f2-)
    
    if [ "$status" == "PASS" ]; then
        new_access_token=$(echo "$body" | jq -r '.data.accessToken' 2>/dev/null)
        if [ -n "$new_access_token" ] && [ "$new_access_token" != "null" ]; then
            log_test "Refresh token with valid token" "PASS" "New access token received"
        else
            log_test "Refresh token with valid token" "FAIL" "No new token received"
        fi
    else
        log_test "Refresh token with valid token" "FAIL" "$body"
    fi
    
    # Test 7.2: Refresh token inválido
    invalid_refresh='{"refreshToken":"invalid_token"}'
    result=$(test_endpoint "POST" "/api/v1/auth/refresh" "$invalid_refresh" "" "401")
    status=$(echo "$result" | cut -d'|' -f1)
    log_test "Refresh token with invalid token (should fail)" "$status"
else
    log_test "Refresh token tests" "FAIL" "No refresh token available"
fi

# ============================================
# Resumen Final
# ============================================

echo "" | tee -a "$REPORT_FILE"
echo "============================================" | tee -a "$REPORT_FILE"
echo "TEST SUMMARY" | tee -a "$REPORT_FILE"
echo "============================================" | tee -a "$REPORT_FILE"
echo "Total Tests: $TOTAL_TESTS" | tee -a "$REPORT_FILE"
echo -e "${GREEN}Passed: $PASSED_TESTS${NC}" | tee -a "$REPORT_FILE"
echo -e "${RED}Failed: $FAILED_TESTS${NC}" | tee -a "$REPORT_FILE"

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}✓ All tests passed!${NC}" | tee -a "$REPORT_FILE"
    SUCCESS_RATE=100
else
    SUCCESS_RATE=$((PASSED_TESTS * 100 / TOTAL_TESTS))
    echo -e "${YELLOW}⚠ Some tests failed${NC}" | tee -a "$REPORT_FILE"
fi

echo "Success Rate: ${SUCCESS_RATE}%" | tee -a "$REPORT_FILE"
echo "============================================" | tee -a "$REPORT_FILE"
echo "" | tee -a "$REPORT_FILE"
echo "Report saved to: $REPORT_FILE" | tee -a "$REPORT_FILE"

# Salir con código de error si hay tests fallidos
if [ $FAILED_TESTS -gt 0 ]; then
    exit 1
else
    exit 0
fi
