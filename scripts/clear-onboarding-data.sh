#!/bin/bash
# Clears all tenant, chat history, and session data from DynamoDB.
# Run from your local machine: bash scripts/clear-onboarding-data.sh
# Or on EC2: ssh in and run it there.

set -e

EC2_IP="34.195.8.30"
EC2_USER="ubuntu"
SSH_KEY="$HOME/Downloads/pers-ubuntu.pem"

RED='\033[0;31m'; YELLOW='\033[1;33m'; GREEN='\033[0;32m'; NC='\033[0m'

echo -e "${YELLOW}WARNING: This will permanently delete ALL tenant, chat history, and session data.${NC}"
read -p "Type 'yes' to confirm: " confirm
[ "$confirm" = "yes" ] || { echo "Aborted."; exit 0; }

echo -e "${GREEN}==> Connecting to EC2...${NC}"

ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "$EC2_USER@$EC2_IP" bash << 'ENDSSH'
set -e
REGION="us-east-1"

delete_table() {
  local TABLE=$1
  local HASH_KEY=$2
  local RANGE_KEY=$3

  echo "--- Clearing $TABLE ---"
  ITEMS=$(aws dynamodb scan --table-name "$TABLE" --region "$REGION" \
    --query "Items[*]" --output json 2>/dev/null) || { echo "  Skipped (table not found)."; return; }

  COUNT=$(echo "$ITEMS" | python3 -c "import json,sys; print(len(json.load(sys.stdin)))")
  echo "  Found $COUNT items"
  [ "$COUNT" -eq 0 ] && { echo "  Nothing to delete."; return; }

  echo "$ITEMS" | python3 -c "
import json, sys, subprocess
items = json.load(sys.stdin)
for item in items:
    key = {'$HASH_KEY': item['$HASH_KEY']}
    $([ -n "$RANGE_KEY" ] && echo "if '$RANGE_KEY' in item: key['$RANGE_KEY'] = item['$RANGE_KEY']")
    subprocess.run(['aws','dynamodb','delete-item','--table-name','$TABLE',
                    '--region','$REGION','--key',json.dumps(key)],
                   check=True, capture_output=True)
print(f'  Deleted {len(items)} items from $TABLE')
"
}

delete_table "chatbot-tenants"      "tenantId"  ""
delete_table "chatbot-chat-history" "sessionId" "timestamp"
delete_table "chatbot-sessions"     "sessionId" ""

echo ""
echo "All data cleared."
ENDSSH

echo -e "${GREEN}==> Clear complete.${NC}"
