#!/usr/bin/env bash
# Exit on error
set -o errexit

# Install Python backend dependencies
pip install -r requirements.txt

# Build the React frontend
cd frontend-react
npm install
npm run build
cd ..

# Pre-download the FastEmbed weights so Gunicorn doesn't timeout on boot
echo "Pre-downloading FastEmbed model weights..."
python -c "from langchain_community.embeddings.fastembed import FastEmbedEmbeddings; FastEmbedEmbeddings()"
echo "Done!"
