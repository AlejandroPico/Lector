import {it,expect} from 'vitest'
import {dragProgress,completesDrag} from '../src/book-page-drag.js'
import {safeSettings} from '../src/storage.js'
import {portablePreferences} from '../src/sync-core.js'

it('uses screen coordinates in either direction, clamps overshoot and allows reversing a drag',()=>{
  expect(dragProgress(1000,600,1,1000)).toBe(.4)
  expect(dragProgress(0,400,-1,1000)).toBe(.4)
  expect(dragProgress(1000,980,1,1000)).toBe(.02)
  expect(dragProgress(1000,1200,1,1000)).toBe(0)
  expect(dragProgress(1000,-200,1,1000)).toBe(1)
  expect(Number.isFinite(dragProgress(0,100,-1,0))).toBe(true)
})
it('requires deliberate travel before committing, independent of event timing',()=>{
  expect(completesDrag(.349)).toBe(false)
  expect(completesDrag(.35)).toBe(true)
  expect(completesDrag(1)).toBe(true)
  expect(completesDrag(0)).toBe(false)
})
it('retains an explicit opt-out and shares only the preference through voluntary sync',()=>{
  expect(safeSettings().bookCornerDrag).toBe(true)
  expect(safeSettings({bookCornerDrag:false}).bookCornerDrag).toBe(false)
  expect(safeSettings({bookCornerDrag:'false'}).bookCornerDrag).toBe(true)
  expect(portablePreferences({bookCornerDrag:false,gesture:{pointerId:10}})).toEqual({bookCornerDrag:false})
})
