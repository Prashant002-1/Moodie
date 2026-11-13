// Only fixed SQL identifiers and parameter placeholders from source code may be
// passed to these helpers. User input always remains a bound query parameter.
export const visiblePerson = (viewer: string, author: string) => `
  NOT EXISTS (SELECT 1 FROM user_blocks safety_block WHERE
    (safety_block.blocker_id = ${viewer} AND safety_block.blocked_id = ${author}) OR
    (safety_block.blocked_id = ${viewer} AND safety_block.blocker_id = ${author}))
  AND NOT EXISTS (SELECT 1 FROM moderation_actions safety_person
    WHERE safety_person.target_kind = 'person' AND safety_person.target_id = ${author})`;

export const visibleResponse = (viewer: string, entry = 'de') => `
  ${visiblePerson(viewer, `${entry}.user_id`)}
  AND NOT EXISTS (SELECT 1 FROM moderation_actions safety_response
    WHERE safety_response.target_kind = 'response' AND safety_response.target_id = ${entry}.id)`;

export const visibleComment = (viewer: string, comment = 'ec') => `
  ${visiblePerson(viewer, `${comment}.user_id`)}
  AND NOT EXISTS (SELECT 1 FROM moderation_actions safety_comment
    WHERE safety_comment.target_kind = 'comment' AND safety_comment.target_id = ${comment}.id)`;
