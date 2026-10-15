import { prisma } from '@/server/db/prisma';
import { razorTest, testPlan } from './razorpay-test';
export async function refreshTestSubscription(providerId:string){
  const row=await prisma.testBillingSubscription.findUnique({where:{providerId}});
  if(!row)throw new Error('Unknown TEST subscription.');
  const remote=await razorTest('subscriptions/'+providerId);
  if(remote.id!==providerId)throw new Error('Provider identity mismatch.');
  const code=remote.plan_id===testPlan('WEBSITE_SINGLE').id?'WEBSITE_SINGLE':remote.plan_id===testPlan('WEBSITE_MULTI').id?'WEBSITE_MULTI':null;
  if(!code)throw new Error('Unknown TEST plan.');
  // Only TEST bookkeeping is updated. Checkout success or webhook never grants paid access.
  return prisma.testBillingSubscription.update({where:{id:row.id},data:{providerStatus:remote.status,planCode:code,...(row.pendingPlanCode===code?{pendingPlanCode:null}:{}),currentStart:remote.current_start||null,currentEnd:remote.current_end||null}});
}
