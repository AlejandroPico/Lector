// Only fixed, body-free SDK script downloads are exempt from content privacy checks.
export function watchPrivateRequests(page) {
  const external=[]
  page.on('request',request=>{
    const url=request.url()
    const sdk=request.method()==='GET'&&request.resourceType()==='script'&&request.postData()===null
      &&/^https:\/\/www\.gstatic\.com\/(?:cv\/js\/sender\/v1\/cast_sender\.js\?loadCastFramework=1|eureka\/clank\/(?:\d+\/)?cast_sender\.js|cast\/sdk\/libs\/sender\/1\.0\/cast_framework\.js)$/.test(url)
    if(url.startsWith('https:')&&!sdk)external.push(url)
  })
  return external
}
