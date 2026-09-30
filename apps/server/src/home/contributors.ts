import { listUsers } from '../services/users'
import { registerHomeContributor } from './registry'

registerHomeContributor('members', ({ deps }) => listUsers(deps))
