export default function CategoryFilters({ categories, selectedCategory, onSelect }) {
  return (
    <div className="filter-row" role="group" aria-label="Filter clinics by category">
      <button
        className={`filter-chip${selectedCategory === 'all' ? ' is-selected' : ''}`}
        type="button"
        aria-pressed={selectedCategory === 'all'}
        onClick={() => onSelect('all')}
      >All categories</button>
      {categories.map((category) => (
        <button
          className={`filter-chip${selectedCategory === category.id ? ' is-selected' : ''}`}
          type="button"
          aria-pressed={selectedCategory === category.id}
          key={category.id}
          onClick={() => onSelect(category.id)}
        >{category.name}</button>
      ))}
    </div>
  );
}
