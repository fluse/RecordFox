#!/bin/bash

# Abort the script if an error occurs
set -e

echo "🚀 Starting RecordFox release process..."
echo "--------------------------------------"

# 1. Ask for version and validate
read -p "Enter the new version number (MUST start with 'v', e.g., v1.0.1): " VERSION

if [[ ! $VERSION == v* ]]; then
  echo "❌ Error: The version must start with 'v' to trigger the GitHub workflow."
  exit 1
fi

# Check if the tag already exists locally
if git rev-parse "$VERSION" >/dev/null 2>&1; then
  echo "❌ Error: The tag $VERSION already exists locally."
  exit 1
fi

# 2. Ask for a commit message
read -p "Enter a short commit message (e.g., 'Fix window size bug'): " COMMIT_MSG

if [[ -z "$COMMIT_MSG" ]]; then
  echo "❌ Error: The commit message cannot be empty."
  exit 1
fi

# Determine the current branch (usually 'main' or 'master')
CURRENT_BRANCH=$(git branch --show-current)

# Show summary and get confirmation
echo ""
echo "📦 Summary of planned actions:"
echo "- Update package.json version to: '$VERSION'"
echo "- All current changes will be added (git add .)"
echo "- Commit message: '$COMMIT_MSG'"
echo "- New tag:        '$VERSION'"
echo "- Target branch:  '$CURRENT_BRANCH' -> origin"
echo "--------------------------------------"

read -p "Do you want to start the release process now? (y/n): " CONFIRM
if [[ "$CONFIRM" != "y" && "$CONFIRM" != "Y" ]]; then
  echo "🛑 Cancelled by user. No changes were made."
  exit 0
fi

echo ""
echo "⚙️ Executing commands..."

# 3. Update version in package.json (and package-lock.json if present)
# --no-git-tag-version prevents npm from creating its own git commit/tag automatically
echo "📝 Updating package.json..."
npm version "$VERSION" --no-git-tag-version

# 4. Add changes
git add .

# 5. Create commit
git commit -m "$COMMIT_MSG"

# 6. Create tag
git tag "$VERSION"

# 7. Push branch and tag
echo "⬆️ Pushing code to branch '$CURRENT_BRANCH'..."
git push origin "$CURRENT_BRANCH"

echo "⬆️ Pushing tag '$VERSION'..."
git push origin "$VERSION"

echo ""
echo "✅ Release $VERSION successfully triggered!"
echo "You can now track the build status in the GitHub 'Actions' tab."