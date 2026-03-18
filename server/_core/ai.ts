import axios from "axios";
import { ENV } from "./env";

interface AIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/**
 * AI Service - Integrates with OpenAI, Groq, or other API providers
 * Provides intelligent course recommendations and learning guidance
 */

export class AIService {
  private get openaiKey() {
    return process.env.OPENAI_API_KEY;
  }

  private get groqKey() {
    return process.env.GROQ_API_KEY;
  }

  private get anthropicKey() {
    return process.env.ANTHROPIC_API_KEY;
  }

  private hasAnyProviderConfigured(): boolean {
    const openai = this.openaiKey;
    const groq = this.groqKey;
    const anthropic = this.anthropicKey;

    return Boolean(
      (openai && !openai.startsWith("sk-your")) ||
      (groq && groq.trim().length > 0) ||
      (anthropic && anthropic.trim().length > 0)
    );
  }

  private generateLocalFallback(messages: AIMessage[]): string {
    const latestUser = [...messages].reverse().find((message) => message.role === "user");
    const prompt = latestUser?.content?.trim() || "your learning goal";

    const lowered = prompt.toLowerCase();
    if (lowered.includes("python")) {
      return "Local AI mode is active (no API keys). For Python, start with beginner fundamentals, then practice with data handling and small automation projects. Search for Python courses and prioritize high-rated beginner/intermediate options with projects.";
    }

    if (lowered.includes("react") || lowered.includes("web")) {
      return "Local AI mode is active (no API keys). For web development, follow a sequence: HTML/CSS basics -> JavaScript fundamentals -> React component patterns -> full-stack project deployment.";
    }

    if (lowered.includes("machine learning") || lowered.includes("ai")) {
      return "Local AI mode is active (no API keys). A strong ML path is: Python + statistics basics -> supervised learning -> model evaluation -> one end-to-end portfolio project.";
    }

    return `Local AI mode is active (no API keys). For \"${prompt}\", start with 1 beginner course, complete a guided project, then move to intermediate depth. Focus on courses with strong ratings, meaningful reviews, and clear outcomes.`;
  }

  /**
   * Generate AI response using OpenAI GPT
   */
  async generateWithOpenAI(messages: AIMessage[]): Promise<string> {
    if (!this.openaiKey || this.openaiKey.startsWith("sk-your")) {
      throw new Error("OpenAI API key not configured. Please add OPENAI_API_KEY to .env");
    }

    try {
      const response = await axios.post(
        "https://api.openai.com/v1/chat/completions",
        {
          model: "gpt-3.5-turbo",
          messages: messages,
          temperature: 0.7,
          max_tokens: 1000,
        },
        {
          headers: {
            Authorization: `Bearer ${this.openaiKey}`,
            "Content-Type": "application/json",
          },
        }
      );

      return response.data.choices[0].message.content;
    } catch (error: any) {
      console.error("OpenAI API error:", error.response?.data || error.message);
      throw new Error("Failed to get AI response from OpenAI");
    }
  }

  /**
   * Generate AI response using Groq (faster, free tier available)
   */
  async generateWithGroq(messages: AIMessage[]): Promise<string> {
    if (!this.groqKey || this.groqKey === "") {
      throw new Error("Groq API key not configured");
    }

    try {
      const response = await axios.post(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          model: "mixtral-8x7b-32768",
          messages: messages,
          temperature: 0.7,
          max_tokens: 1000,
        },
        {
          headers: {
            Authorization: `Bearer ${this.groqKey}`,
            "Content-Type": "application/json",
          },
        }
      );

      return response.data.choices[0].message.content;
    } catch (error: any) {
      console.error("Groq API error:", error.response?.data || error.message);
      throw new Error("Failed to get AI response from Groq");
    }
  }

  /**
   * Generate AI response using Anthropic Claude
   */
  async generateWithAnthropic(messages: AIMessage[]): Promise<string> {
    if (!this.anthropicKey || this.anthropicKey === "") {
      throw new Error("Anthropic API key not configured");
    }

    try {
      const systemMessages = messages
        .filter((message) => message.role === "system")
        .map((message) => message.content);

      const conversationMessages = messages
        .filter((message) => message.role !== "system")
        .map((message) => ({
          role: message.role,
          content: message.content,
        }));

      const response = await axios.post(
        "https://api.anthropic.com/v1/messages",
        {
          model: "claude-3-sonnet-20240229",
          max_tokens: 1000,
          system: systemMessages.join("\n\n") || "You are an expert educational AI assistant helping users find the perfect online courses. Provide detailed, personalized course recommendations based on their learning goals, skill level, and interests.",
          messages: conversationMessages,
        },
        {
          headers: {
            "x-api-key": this.anthropicKey,
            "Content-Type": "application/json",
            "anthropic-version": "2023-06-01",
          },
        }
      );

      return response.data.content[0].text;
    } catch (error: any) {
      console.error("Anthropic API error:", error.response?.data || error.message);
      throw new Error("Failed to get AI response from Anthropic");
    }
  }

  /**
   * Main method - tries OpenAI first, then falls back
   */
  async generateResponse(messages: AIMessage[]): Promise<string> {
    if (!this.hasAnyProviderConfigured() && ENV.localAiFallbackEnabled) {
      return this.generateLocalFallback(messages);
    }

    // Try OpenAI first (most reliable)
    if (this.openaiKey && !this.openaiKey.startsWith("sk-your")) {
      try {
        return await this.generateWithOpenAI(messages);
      } catch (error) {
        console.warn("OpenAI failed, trying fallback");
      }
    }

    // Try Groq (free tier available)
    if (this.groqKey && this.groqKey !== "") {
      try {
        return await this.generateWithGroq(messages);
      } catch (error) {
        console.warn("Groq failed, trying fallback");
      }
    }

    // Try Anthropic
    if (this.anthropicKey && this.anthropicKey !== "") {
      try {
        return await this.generateWithAnthropic(messages);
      } catch (error) {
        console.warn("Anthropic failed");
      }
    }

    if (ENV.localAiFallbackEnabled) {
      return this.generateLocalFallback(messages);
    }

    throw new Error(
      "No AI service configured. Please add OPENAI_API_KEY, GROQ_API_KEY, or ANTHROPIC_API_KEY to .env"
    );
  }
}

export const aiService = new AIService();
