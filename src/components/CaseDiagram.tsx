import { ALG_SET_BY_ID, type AlgSetId, type FaceletString } from '@/data'
import { LLDiagram } from './LLDiagram'
import { StageDiagram } from './StageDiagram'
import { ZblsDiagram } from './ZblsDiagram'

export interface CaseDiagramProps {
  algSet: AlgSetId
  facelets: FaceletString
  className?: string
  label?: string
}

/**
 * Dispatches to `LLDiagram`, `StageDiagram`, or `ZblsDiagram` based on the algorithm set.
 */
export function CaseDiagram({ algSet, facelets, className, label }: CaseDiagramProps) {
  if (algSet === 'ZBLS') {
    return <ZblsDiagram facelets={facelets} className={className} label={label} />
  }
  const def = ALG_SET_BY_ID.get(algSet)
  if (def?.diagram === 'stage') {
    return <StageDiagram facelets={facelets} className={className} label={label} />
  }
  return <LLDiagram facelets={facelets} className={className} label={label} />
}

export default CaseDiagram
