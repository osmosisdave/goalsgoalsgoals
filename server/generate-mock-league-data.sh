#!/bin/bash

echo "================================================"
echo "Generating Mock League Data"
echo "================================================"
echo ""

echo "Step 1: Seeding 2025 fixtures..."
echo "----------------------------------------"
cd "$(dirname "$0")"
node seed_mock_fixtures_2025.js
if [ $? -ne 0 ]; then
    echo "❌ Error seeding fixtures"
    exit 1
fi

echo ""
echo "Step 2: Adding results to first 20 gameweeks..."
echo "----------------------------------------"
node update_fixtures_with_results.js
if [ $? -ne 0 ]; then
    echo "❌ Error updating fixtures with results"
    exit 1
fi

echo ""
echo "Step 3: Seeding match selections..."
echo "----------------------------------------"
node seed_mock_match_selections.js
if [ $? -ne 0 ]; then
    echo "❌ Error seeding match selections"
    exit 1
fi

echo ""
echo "================================================"
echo "✅ Mock League Data Generation Complete!"
echo "================================================"
echo ""
echo "Summary:"
echo "  • 6,840 fixtures created (18 leagues × 38 gameweeks)"
echo "  • First 20 gameweeks completed with results"
echo "  • 160 match selections created (8 users × 20 selections)"
echo ""
