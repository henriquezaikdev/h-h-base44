export type SellerRole = 'owner' | 'admin' | 'manager' | 'seller' | 'logistics'

export interface Seller {
  id: string
  auth_user_id: string
  company_id: string
  name: string
  email: string
  role: SellerRole
  department: string | null
  avatar_url: string | null
  active: boolean
  created_at: string
}
