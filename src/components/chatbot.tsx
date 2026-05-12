
"use client";

import { useState, useRef, useEffect } from 'react';
import { Bot, MessageSquare, Send, X, User, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useApp } from '@/hooks/use-app';
import { conversationalFinanceAssistant, ConversationalFinanceAssistantInput } from '@/ai/flows/conversational-finance-assistant';
import { Avatar, AvatarFallback } from './ui/avatar';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function Chatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { profile, transactions, goals } = useApp();
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
        setMessages([
            { role: 'assistant', content: "Hello! How can I help you with your finances today? You can ask me things like 'Can I afford to eat out?' or 'What's my safe spending limit?'" }
        ]);
    }
  }, [isOpen]);

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTo({ top: scrollAreaRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages]);

  const handleSend = async () => {
    if (input.trim() === '' || !profile) {
      if (!profile) {
        toast({
          variant: 'destructive',
          title: 'Profile needed',
          description: 'Please complete onboarding to use the chatbot.'
        });
      }
      return;
    }

    const userMessage: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const assistantInput: ConversationalFinanceAssistantInput = {
        query: input,
        role: profile.role || 'Professional',
        income: profile.income,
        fixedExpenses: profile.fixedExpenses.map(e => ({ name: e.name, amount: e.amount })),
        dailySpendingLimit: profile.dailySpendingLimit,
        savings: goals.reduce((sum, g) => sum + g.currentAmount, 0),
      };

      const result = await conversationalFinanceAssistant(assistantInput);
      const assistantMessage: Message = { role: 'assistant', content: result.response };
      setMessages(prev => [...prev, assistantMessage]);

    } catch (error) {
      console.error("Chatbot error:", error);
      const errorMessage: Message = { role: 'assistant', content: "Chatbot failed to connect. If you didn't set GEMINI_API_KEY in .env.local, the AI cannot run. Otherwise, try again later." };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className={cn("fixed bottom-6 right-6 z-50 transition-transform duration-300 ease-in-out", isOpen ? "scale-0" : "scale-100")}>
        <Button size="icon" className="rounded-full w-16 h-16 shadow-lg" onClick={() => setIsOpen(true)}>
          <Bot className="h-8 w-8" />
        </Button>
      </div>

      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50">
          <Card className="w-[380px] h-[550px] shadow-2xl flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="flex items-center gap-3">
                <Bot className="h-6 w-6 text-primary" />
                <CardTitle>PocketMate Assistant</CardTitle>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden p-0">
                <ScrollArea className="h-full p-4" ref={scrollAreaRef}>
                    <div className="space-y-4">
                    {messages.map((message, index) => (
                        <div key={index} className={cn("flex items-start gap-3", message.role === 'user' ? 'justify-end' : '')}>
                            {message.role === 'assistant' && (
                                <Avatar className="w-8 h-8">
                                    <AvatarFallback><Bot className="w-5 h-5"/></AvatarFallback>
                                </Avatar>
                            )}
                            <div className={cn("max-w-[80%] rounded-lg px-3 py-2 text-sm", 
                                message.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-secondary'
                            )}>
                                {message.content}
                            </div>
                             {message.role === 'user' && (
                                <Avatar className="w-8 h-8">
                                    <AvatarFallback><User className="w-5 h-5"/></AvatarFallback>
                                </Avatar>
                            )}
                        </div>
                    ))}
                    {isLoading && (
                       <div className="flex items-start gap-3">
                           <Avatar className="w-8 h-8">
                               <AvatarFallback><Bot className="w-5 h-5"/></AvatarFallback>
                           </Avatar>
                           <div className="bg-secondary rounded-lg px-3 py-2 text-sm flex items-center">
                               <Loader2 className="h-4 w-4 animate-spin" />
                           </div>
                       </div>
                    )}
                    </div>
                </ScrollArea>
            </CardContent>
            <CardFooter>
              <div className="flex w-full items-center space-x-2">
                <Input
                  placeholder="Ask a financial question..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                  disabled={isLoading}
                />
                <Button onClick={handleSend} disabled={isLoading}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </CardFooter>
          </Card>
        </div>
      )}
    </>
  );
}
