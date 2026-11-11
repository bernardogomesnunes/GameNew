"""Every model, by group, in the order the contact sheets show them."""
import featured, fauna

GROUPS = {
    'featured': [fauna.COW, fauna.MOON_COW, featured.EXPLORER, featured.SKY],
    'animals': [fauna.COW] + fauna.ANIMALS,
    'creatures': [fauna.MOON_COW] + fauna.CREATURES,
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
try:
    import dragons
    GROUPS['dragons'] = dragons.DRAGONS
except ImportError:
    pass
try:
    import machines
    GROUPS['machines'] = machines.MACHINES
except ImportError:
    pass
