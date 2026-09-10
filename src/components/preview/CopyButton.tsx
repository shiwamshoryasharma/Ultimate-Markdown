import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import styles from './CopyButton.module.css'

interface CopyButtonProps {
  text: string
}

export function CopyButton({ text }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  const handleClick = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      // Clipboard access can be denied by the browser — fail silently, the button just won't confirm.
    }
  }

  return (
    <button type="button" className={styles.button} onClick={handleClick} title="Copy code" aria-label="Copy code">
      {copied ? <Check /> : <Copy />}
      <span>{copied ? 'Copied' : 'Copy'}</span>
    </button>
  )
}
