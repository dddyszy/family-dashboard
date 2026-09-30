import { listLists, pendingItemsByList } from '../services/shopping'
import { listUsers } from '../services/users'
import { registerHomeContributor } from './registry'

registerHomeContributor('members', ({ deps }) => listUsers(deps))

registerHomeContributor('shopping', ({ deps, viewer }) => {
  const lists = listLists(deps, viewer)
  return {
    lists,
    pendingItems: pendingItemsByList(
      deps,
      lists.map((l) => l.id),
    ),
  }
})
