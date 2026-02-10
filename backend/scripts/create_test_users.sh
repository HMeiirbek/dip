#!/bin/bash
# Quick script to create test users for cross-device testing

set -e

echo "Creating test users for DIP..."

# Create default test users
node scripts/create_user.js --username alice --password secret123 && echo "✓ Created: alice"
node scripts/create_user.js --username bob --password secret123 && echo "✓ Created: bob"
node scripts/create_user.js --username charlie --password secret123 && echo "✓ Created: charlie"
node scripts/create_user.js --username mobile-user --password phone123 && echo "✓ Created: mobile-user"

echo ""
echo "✅ Test users created successfully!"
echo ""
echo "You can now login with:"
echo "  alice / secret123"
echo "  bob / secret123"
echo "  charlie / secret123"
echo "  mobile-user / phone123"
