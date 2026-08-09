import { ALG_SET_BY_ID, type AlgSetId, type FaceletString } from '@/data'
import { EoDiagram } from './EoDiagram'
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
 * Picks the diagram a set declares in `AlgSetDef.diagram`, never by matching the
 * set's id. Which representation a set needs is a property of the set, and the
 * registry is where that lives — a switch on the id here is how the views start
 * knowing set names again, which is the coupling Issue 10 removed.
 */
export function CaseDiagram({ algSet, facelets, className, label }: CaseDiagramProps) {
  const props = { facelets, className, label }
  switch (ALG_SET_BY_ID.get(algSet)?.diagram) {
    case 'eo':
      return <EoDiagram {...props} />
    case 'zbls':
      return <ZblsDiagram {...props} />
    case 'stage':
      return <StageDiagram {...props} />
    default:
      return <LLDiagram {...props} />
  }
}

export default CaseDiagram
