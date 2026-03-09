# AI API Setup Guide

Your AI chatbot is now ready! To enable real AI responses, configure one of these AI providers:

## Quick Start (Choose One)

### **Option 1: OpenAI (Recommended)**
1. Go to https://platform.openai.com/api-keys
2. Create a new secret key
3. Copy the key and add to `.env`:
```
OPENAI_API_KEY=sk-your-actual-key-here
```

### **Option 2: Groq (Fast & Free Tier)**
1. Go to https://console.groq.com/keys
2. Create an API key
3. Add to `.env`:
```
GROQ_API_KEY=your-actual-key-here
```

### **Option 3: Anthropic Claude**
1. Go to https://console.anthropic.com/keys
2. Generate an API key
3. Add to `.env`:
```
ANTHROPIC_API_KEY=your-actual-key-here
```

## How AI Integration Works

- **Searches your course database** for relevant courses
- **Sends user message + course context** to AI API
- **Gets intelligent response** with personalized recommendations
- **Falls back gracefully** if API unavailable (uses smart keyword matching)

## Testing

1. Run `npm run build`
2. Start your dev server
3. Click the chat button
4. Ask: "Recommend me Python courses"
5. Get AI-powered recommendations!

## Pricing

- **OpenAI**: ~$0.001-0.002 per chat message
- **Groq**: Free tier available, very fast
- **Anthropic**: Pay-as-you-go pricing

## No API Key?

The chatbot will still work! It uses an intelligent fallback that:
- Searches your course database
- Provides smart recommendations
- Uses keyword matching to understand intent
