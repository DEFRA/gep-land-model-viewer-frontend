import { useContext } from 'react'
import { InfoPanelContext } from './context.js'
import { LinkButton } from '../../../../components/LinkButton.jsx'

export function Unavailable ({ typeLabel, children }) {
  const { goToSampleArea } = useContext(InfoPanelContext)

  return (
    <div className='app-map__info-content'>
      {children}
      <div className='app-map__info-unavailable'>
        <p className='govuk-body'>This {typeLabel} is not covered by the sample land model.</p>
        <LinkButton onClick={goToSampleArea}>Go to the sample area</LinkButton>
      </div>
    </div>
  )
}
