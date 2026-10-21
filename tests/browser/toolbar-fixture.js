export async function toolbarAction(page,id) {
  const action=page.locator(`#${id}`)
  if(await action.isHidden())await page.locator('#tools-toggle').click()
  await action.click()
}
