import { SignupForm } from "@/components/signup-form"
import { getDistinctDepartments } from "@/lib/db/queries"

export default async function SignupPage() {
  const departments = await getDistinctDepartments()
  return <SignupForm departments={departments} />
}
