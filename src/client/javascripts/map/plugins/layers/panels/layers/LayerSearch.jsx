import { useEffect, useRef } from 'react'
import { InlineIcon } from '../../../../components/InlineIcon.jsx'
import { SEARCH_ICON } from '../../icons.js'

export function LayerSearch ({ query, onSearch }) {
  const inputRef = useRef(null)

  useEffect(() => {
    inputRef.current.value = query
  }, [query])

  const handleSubmit = (e) => {
    e.preventDefault()
    onSearch(inputRef.current.value)
  }

  const handleInput = (event) => {
    if (!event.currentTarget.value) {
      onSearch('')
    }
  }

  return (
    <div className='govuk-form-group app-map__layer-search'>
      <label className='govuk-label' htmlFor='layers-search'>Search</label>
      <form className='app-map__layer-search-row' role='search' aria-label='Search layers' onSubmit={handleSubmit}>
        <input
          ref={inputRef}
          className='govuk-input app-map__layer-search-input'
          id='layers-search'
          type='search'
          placeholder='Find datasets'
          autoComplete='off'
          aria-controls='layers-list'
          defaultValue={query}
          onInput={handleInput}
        />
        <button
          className='govuk-button app-map__layer-search-button'
          type='submit'
          aria-label='Search layers'
          data-module='govuk-button'
        >
          <InlineIcon className='app-map__layer-search-icon' content={SEARCH_ICON} />
        </button>
      </form>
    </div>
  )
}
