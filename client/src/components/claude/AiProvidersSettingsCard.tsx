// client/src/components/claude/AiProvidersSettingsCard.tsx

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useAiProviders, useActiveProvider, useSetActiveProvider } from '@/hooks/useAiProvider'
import { AiProviderConfigDialog } from './AiProviderConfigDialog'
import { Sparkles, Settings, Check, Terminal, Cpu, Zap, Brain } from 'lucide-react'

const providerIcons = {
  claude: Sparkles,
  openai: Brain,
  gemini: Zap,
  ollama: Cpu,
}

const providerDescriptions = {
  claude: 'Anthropic Claude - High-quality AI with strong reasoning capabilities',
  openai: 'OpenAI GPT models - Industry-leading language models',
  gemini: 'Google Gemini - Fast and capable multimodal AI',
  ollama: 'Ollama - Run AI models locally on your machine',
}

export function AiProvidersSettingsCard() {
  const { data: providers, isLoading } = useAiProviders()
  const activeProvider = useActiveProvider()
  const setActiveProvider = useSetActiveProvider()
  const [configOpen, setConfigOpen] = useState<string | null>(null)

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            AI Providers
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">Loading providers...</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            AI Providers
            {activeProvider && (
              <Badge variant="default" className="text-[10px] px-1.5 py-0 bg-green-600">
                <Check className="h-2.5 w-2.5 mr-0.5" />
                {activeProvider.name}
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            Configure multiple AI providers and choose which one should be active.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {providers?.map((provider) => {
            const Icon = providerIcons[provider.id as keyof typeof providerIcons] || Sparkles
            const isActive = activeProvider?.id === provider.id

            return (
              <div key={provider.id} className="flex items-center justify-between bg-muted/30 rounded-lg p-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className="h-4 w-4" />
                    <p className="text-sm font-medium">{provider.name}</p>
                    {isActive && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        Active
                      </Badge>
                    )}
                    {provider.configured && (
                      <Badge variant="default" className="text-[10px] px-1.5 py-0 bg-blue-600">
                        <Check className="h-2.5 w-2.5 mr-0.5" />
                        Configured
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">
                    {providerDescriptions[provider.id as keyof typeof providerDescriptions]}
                  </p>

                  {/* Model info */}
                  {provider.configured && (
                    <div className="text-xs text-muted-foreground">
                      {provider.config.model && (
                        <span>Model: {provider.config.model}</span>
                      )}
                      {provider.id === 'ollama' && provider.config.baseUrl && (
                        <span> • URL: {provider.config.baseUrl}</span>
                      )}
                    </div>
                  )}

                  {/* Available models */}
                  {provider.models.length > 0 && (
                    <div className="text-xs text-muted-foreground mt-1">
                      Available: {provider.models.join(', ')}
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  {provider.configured && !isActive && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setActiveProvider(provider.id)}
                      className="h-7 text-xs"
                    >
                      Use
                    </Button>
                  )}
                  {provider.configured ? (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setConfigOpen(provider.id)}
                        className="gap-1 h-7 text-xs"
                      >
                        <Settings className="h-3 w-3" />
                        Edit
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setConfigOpen(provider.id)}
                      className="gap-1 h-7 text-xs"
                    >
                      Setup
                    </Button>
                  )}
                </div>
              </div>
            )
          })}

          {/* Feature list */}
          {providers?.some(p => p.configured) && (
            <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t">
              <p className="font-medium">Available features:</p>
              <ul className="list-disc list-inside space-y-0.5 ml-1">
                <li>Chat panel with streaming responses</li>
                <li>AI task analysis and improvement</li>
                <li>Bulk task import with AI organization</li>
                <li>Automatic commit message generation</li>
                <li>Project-aware context in all interactions</li>
              </ul>
            </div>
          )}

          {!providers?.some(p => p.configured) && (
            <div className="text-center py-4 border-t">
              <p className="text-xs text-muted-foreground">
                Configure at least one AI provider above to enable AI features.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Config Dialog */}
      {configOpen && (
        <AiProviderConfigDialog
          providerId={configOpen}
          open={true}
          onOpenChange={(open) => !open && setConfigOpen(null)}
        />
      )}
    </>
  )
}
