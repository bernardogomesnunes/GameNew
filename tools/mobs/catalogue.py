"""Every model, by group, in the order the contact sheets show them."""
import featured, animals

GROUPS = {
    'featured': [featured.COW, featured.MOON_COW, featured.EXPLORER, featured.SKY],
    'animals': [featured.COW] + animals.ANIMALS,
    'creatures': [featured.MOON_COW] + animals.CREATURES,
}
try:
    import people
    GROUPS['people'] = people.PEOPLE[:9] + [featured.EXPLORER] + people.PEOPLE[9:] + [featured.SKY]
except ImportError:
    pass
try:
    import vehicles
    GROUPS['vehicles'] = vehicles.VEHICLES
except ImportError:
    pass
