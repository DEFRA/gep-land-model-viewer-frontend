import { useContext } from 'react'
import { InfoPanelContext } from '../../panels/info/context.js'
import { LinkButton } from '../../../../components/LinkButton.jsx'

export function OutsideSampleArea ({ typeLabel }) {
  const { goToSampleArea } = useContext(InfoPanelContext)

  return (
    <div className='govuk-inset-text app-map__summary-outside-sample'>
      <p className='govuk-body'>This {typeLabel} is not covered by the sample land model.</p>
      <LinkButton onClick={goToSampleArea}>Go to the sample area</LinkButton>
    </div>
  )
}
