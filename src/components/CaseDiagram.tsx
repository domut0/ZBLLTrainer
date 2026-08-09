import { ALG_SET_BY_ID, type AlgSetId, type FaceletString } from '@/data'
import { EoDiagram } from './EoDiagram'
import { LLDiagram } from './LLDiagram'
import { StageDiagram } from './StageDiagram'

export interface CaseDiagramProps {
  algSet: AlgSetId
  facelets: FaceletString
  className?: string
  label?: string
}

/**
 * Dispatches to `LLDiagram`, `StageDiagram`, or `EoDiagram` based on the
 * algorithm set's `diagram` setting (`AlgSetDef.diagram`).
 */
export function CaseDiagram({ algSet, facelets, className, label }: CaseDiagramProps) {
  const def = ALG_SET_BY_ID.get(algSet)
  if (def?.diagram === 'eo') {
    return <EoDiagram facelets={facelets} className={className} label={label} />
  }
  if (def?.diagram === 'stage') {
    return <StageDiagram facelets={facelets} className={className} label={label} />
  }
  return <LLDiagram facelets={facelets} className={className} label={label} />
}

export default CaseDiagram
