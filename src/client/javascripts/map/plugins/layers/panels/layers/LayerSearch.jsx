import { Search, X } from 'lucide-preact'

export function LayerSearch ({ query, onSearch, onClear, inputRef }) {
  return (
    <div className='govuk-form-group app-map__layer-search'>
      <label className='govuk-label govuk-visually-hidden' htmlFor='layers-search'>Find datasets</label>
      <div className='app-map__layer-search-row' role='search' aria-label='Search datasets'>
        <Search className='app-map__layer-search-icon' size={20} aria-hidden='true' />
        <input
          ref={inputRef}
          className='govuk-input app-map__layer-search-input'
          id='layers-search'
          type='search'
          placeholder='Find datasets'
          autoComplete='off'
          aria-controls='layers-list'
          value={query}
          onInput={event => onSearch(event.currentTarget.value)}
        />
        {query && (
          <button
            className='app-map__layer-search-clear'
            type='button'
            aria-label='Clear search'
            onClick={onClear}
          >
            <X size={20} aria-hidden='true' />
          </button>
        )}
      </div>
    </div>
  )
}
