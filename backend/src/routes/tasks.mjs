import { requireIdentity, requirePermission } from "../auth/identity.mjs";
import { canManageTasks, cardAccess, internProfile, sendAccessError, validId } from "../tasks/access.mjs";

const text = (value, max = 2000) => typeof value === "string" && value.trim() && value.trim().length <= max ? value.trim() : null;

function staff(request, reply) {
  const identity = requirePermission(request, reply, ["tasks.manage"]);
  if (!identity) return null;
  if (!canManageTasks(identity)) { reply.code(403).send({ error: "forbidden" }); return null; }
  return identity;
}

export async function tasksRoutes(app, { db }) {
  app.post("/v1/tasks/boards", async (request, reply) => {
    const identity = staff(request, reply); if (!identity) return;
    const name = text(request.body?.name, 200); if (!name) return reply.code(400).send({ error: "invalid_name" });
    const result = await db.transaction(identity, (client) => client.query(
      "insert into utero_academy.task_boards(name,description,owner_id) values($1,$2,$3) returning *",
      [name, text(request.body?.description), identity.id],
    ));
    return reply.code(201).send({ board: result.rows[0] });
  });

  app.delete("/v1/tasks/boards/:id", async (request, reply) => {
    const identity = staff(request, reply); if (!identity) return;
    if (!validId(request.params.id)) return reply.code(400).send({ error: "invalid_board_id" });
    return db.transaction(identity, async (client) => {
      const board = await client.query("select owner_id from utero_academy.task_boards where id=$1 for update", [request.params.id]);
      if (!board.rowCount) return reply.code(404).send({ error: "board_not_found" });
      if (!identity.roles.includes("super_admin") && board.rows[0].owner_id !== identity.id) return reply.code(403).send({ error: "forbidden" });
      const cards = await client.query(`select c.id from utero_academy.task_cards c join utero_academy.task_lists l on l.id=c.list_id where l.board_id=$1 for update of c`, [request.params.id]);
      for (const card of cards.rows) { const access=await cardAccess(client,identity,card.id); if(access.error)return sendAccessError(reply,access.error); }
      await client.query("delete from utero_academy.task_boards where id=$1", [request.params.id]);
      return reply.code(204).send();
    });
  });

  app.post("/v1/tasks/lists", async (request, reply) => {
    const identity = staff(request, reply); if (!identity) return;
    const boardId = request.body?.boardId, name = text(request.body?.name, 200);
    if (!validId(boardId) || !name) return reply.code(400).send({ error: "invalid_list" });
    const result = await db.transaction(identity, async (client) => {
      const exists = await client.query("select 1 from utero_academy.task_boards where id=$1", [boardId]);
      if (!exists.rowCount) return null;
      return client.query(`insert into utero_academy.task_lists(board_id,name,order_index)
        select $1,$2,coalesce(max(order_index),-1)+1 from utero_academy.task_lists where board_id=$1 returning *`, [boardId, name]);
    });
    if (!result) return reply.code(404).send({ error: "board_not_found" });
    return reply.code(201).send({ list: result.rows[0] });
  });

  app.delete("/v1/tasks/lists/:id", async (request, reply) => {
    const identity = staff(request, reply); if (!identity) return;
    if (!validId(request.params.id)) return reply.code(400).send({ error: "invalid_list_id" });
    return db.transaction(identity, async (client) => {
      const cards = await client.query("select id from utero_academy.task_cards where list_id=$1 for update", [request.params.id]);
      for (const row of cards.rows) { const access = await cardAccess(client, identity, row.id); if (access.error) return sendAccessError(reply, access.error); }
      const deleted = await client.query("delete from utero_academy.task_lists where id=$1 returning id", [request.params.id]);
      return deleted.rowCount ? reply.code(204).send() : reply.code(404).send({ error: "list_not_found" });
    });
  });

  app.post("/v1/tasks/cards", async (request, reply) => {
    const identity = staff(request, reply); if (!identity) return;
    const { listId, internId, dueAt } = request.body ?? {}; const title = text(request.body?.title, 300);
    if (!validId(listId) || !title || (internId && !validId(internId))) return reply.code(400).send({ error: "invalid_card" });
    const result = await db.transaction(identity, async (client) => {
      if (internId) {
        const mentor = identity.roles.includes("super_admin") ? { rowCount: 1 } : await client.query(`select 1 from utero_academy.mentor_profiles m join utero_academy.mentor_assignments a on a.mentor_id=m.id where m.user_id=$1 and a.intern_id=$2`, [identity.id, internId]);
        if (!mentor.rowCount) return { scopeError: true };
      }
      const list = await client.query("select 1 from utero_academy.task_lists where id=$1", [listId]);
      if (!list.rowCount) return { missing: true };
      const inserted = await client.query(`insert into utero_academy.task_cards(list_id,intern_id,title,description,due_at,order_index,created_by)
        select $1,$2,$3,$4,$5,coalesce(max(order_index),-1)+1,$6 from utero_academy.task_cards where list_id=$1 returning *`,
        [listId, internId || null, title, text(request.body?.description), dueAt || null, identity.id]);
      return { inserted };
    });
    if (result.scopeError) return reply.code(403).send({ error: "intern_out_of_scope" });
    if (result.missing) return reply.code(404).send({ error: "list_not_found" });
    return reply.code(201).send({ card: result.inserted.rows[0] });
  });

  app.patch("/v1/tasks/cards/:id", async (request, reply) => {
    const identity = staff(request, reply); if (!identity) return;
    if (!validId(request.params.id)) return reply.code(400).send({ error: "invalid_card_id" });
    if (request.body?.priority != null && !["urgent", "high", "medium", "low"].includes(request.body.priority)) return reply.code(400).send({ error: "invalid_priority" });
    if (request.body?.listId != null && !validId(request.body.listId)) return reply.code(400).send({ error: "invalid_list_id" });
    if (request.body?.orderIndex != null && (!Number.isSafeInteger(request.body.orderIndex) || request.body.orderIndex < 0)) return reply.code(400).send({ error: "invalid_order" });
    return db.transaction(identity, async (client) => {
      const access = await cardAccess(client, identity, request.params.id); if (access.error) return sendAccessError(reply, access.error);
      const internId = request.body?.internId;
      if (internId && !validId(internId)) return reply.code(400).send({ error: "invalid_intern_id" });
      if (internId && !identity.roles.includes("super_admin")) {
        const allowed = await client.query(`select 1 from utero_academy.mentor_profiles m join utero_academy.mentor_assignments a on a.mentor_id=m.id where m.user_id=$1 and a.intern_id=$2`, [identity.id, internId]);
        if (!allowed.rowCount) return reply.code(403).send({ error: "intern_out_of_scope" });
      }
      let orderIndex=request.body?.orderIndex??null;
      if (request.body?.listId) {
        const list=await client.query("select 1 from utero_academy.task_lists where id=$1 and board_id=$2",[request.body.listId,access.card.board_id]);
        if(!list.rowCount)return reply.code(404).send({error:"list_not_found"});
        if(orderIndex===null){const max=await client.query("select coalesce(max(order_index),-1)+1 as next from utero_academy.task_cards where list_id=$1",[request.body.listId]);orderIndex=max.rows[0].next;}
      }
      const result = await client.query(`update utero_academy.task_cards set intern_id=case when $6 then $2 else intern_id end, priority=coalesce($3,priority), list_id=coalesce($4,list_id), order_index=coalesce($5,order_index), updated_at=now() where id=$1 returning *`, [request.params.id, internId || null, request.body?.priority ?? null, request.body?.listId ?? null, orderIndex, Object.hasOwn(request.body ?? {}, "internId")]);
      return { card: result.rows[0] };
    });
  });

  app.delete("/v1/tasks/cards/:id", async (request, reply) => {
    const identity = staff(request, reply); if (!identity) return;
    if (!validId(request.params.id)) return reply.code(400).send({ error: "invalid_card_id" });
    return db.transaction(identity, async (client) => { const access=await cardAccess(client,identity,request.params.id); if(access.error)return sendAccessError(reply,access.error); await client.query("delete from utero_academy.task_cards where id=$1",[request.params.id]); return reply.code(204).send(); });
  });

  app.post("/v1/tasks/cards/:id/attachments", async (request, reply) => {
    const identity=requireIdentity(request,reply); if(!identity)return;
    if(!identity.permissions.includes("tasks.manage")&&!identity.permissions.includes("tasks.submit"))return reply.code(403).send({error:"forbidden"});
    if(!validId(request.params.id))return reply.code(400).send({error:"invalid_card_id"});
    const path=text(request.body?.path,1000), name=text(request.body?.name,300);
    if(!path||!name||!path.startsWith(`${request.params.id}/`))return reply.code(400).send({error:"invalid_attachment"});
    return db.transaction(identity,async(client)=>{const access=await cardAccess(client,identity,request.params.id);if(access.error)return sendAccessError(reply,access.error);
      const object=await db.query("select mime_type,byte_size from academy_storage.objects where bucket_id='task' and name=$1 and owner_id=$2 and deleted_at is null",[path,identity.id]);
      if(!object.rowCount)return reply.code(404).send({error:"object_not_found"});
      const result=await client.query("insert into utero_academy.task_attachments(card_id,uploaded_by,file_path,file_name,mime_type,size_bytes) values($1,$2,$3,$4,$5,$6) returning *",[request.params.id,identity.id,path,name,object.rows[0].mime_type,object.rows[0].byte_size]);
      return reply.code(201).send({attachment:result.rows[0]});});
  });

  app.get("/v1/tasks/cards/:id/access",async(request,reply)=>{const identity=requireIdentity(request,reply);if(!identity)return;if(!validId(request.params.id))return reply.code(400).send({error:"invalid_card_id"});return db.transaction(identity,async(client)=>{const access=await cardAccess(client,identity,request.params.id);return access.error?sendAccessError(reply,access.error):{cardId:access.card.id};});});

  for (const [kind, table] of [["checklists","task_checklists"],["subtasks","task_subtasks"]]) {
    app.post(`/v1/tasks/cards/:id/${kind}`, async (request, reply) => {
      const identity=requireIdentity(request,reply); if(!identity)return; if(!identity.permissions.includes("tasks.manage") && !identity.permissions.includes("tasks.submit"))return reply.code(403).send({error:"forbidden"}); if(!validId(request.params.id))return reply.code(400).send({error:"invalid_card_id"}); const title=text(request.body?.title,300); if(!title)return reply.code(400).send({error:"invalid_title"});
      return db.transaction(identity,async(client)=>{const access=await cardAccess(client,identity,request.params.id);if(access.error)return sendAccessError(reply,access.error);const result=await client.query(`insert into utero_academy.${table}(card_id,title,order_index) select $1,$2,coalesce(max(order_index),-1)+1 from utero_academy.${table} where card_id=$1 returning *`,[request.params.id,title]);return reply.code(201).send({item:result.rows[0]});});
    });
    app.patch(`/v1/tasks/${kind}/:id`, async (request,reply)=>{const identity=requireIdentity(request,reply);if(!identity)return;if(!validId(request.params.id))return reply.code(400).send({error:"invalid_id"});return db.transaction(identity,async(client)=>{const row=await client.query(`select card_id from utero_academy.${table} where id=$1`,[request.params.id]);if(!row.rowCount)return reply.code(404).send({error:"not_found"});const access=await cardAccess(client,identity,row.rows[0].card_id);if(access.error)return sendAccessError(reply,access.error);await client.query(`update utero_academy.${table} set is_done=$2,updated_at=now() where id=$1`,[request.params.id,Boolean(request.body?.isDone)]);return reply.code(204).send();});});
    app.delete(`/v1/tasks/${kind}/:id`,async(request,reply)=>{const identity=requireIdentity(request,reply);if(!identity)return;if(!validId(request.params.id))return reply.code(400).send({error:"invalid_id"});return db.transaction(identity,async(client)=>{const row=await client.query(`select card_id from utero_academy.${table} where id=$1`,[request.params.id]);if(!row.rowCount)return reply.code(404).send({error:"not_found"});const access=await cardAccess(client,identity,row.rows[0].card_id);if(access.error)return sendAccessError(reply,access.error);await client.query(`delete from utero_academy.${table} where id=$1`,[request.params.id]);return reply.code(204).send();});});
  }
  app.get("/v1/tasks/boards", async (request, reply) => {
    const identity = requirePermission(request, reply, ["tasks.manage"]);
    if (!identity || !canManageTasks(identity)) return identity && reply.code(403).send({ error: "forbidden" });
    const result = await db.transaction(identity, (client) => client.query(
      `select b.id, b.name, b.description, b.owner_id, b.created_at, b.updated_at,
              coalesce(p.full_name, 'Admin') as owner_name
       from utero_academy.task_boards b
       left join utero_academy.user_profiles p on p.id = b.owner_id
       order by b.created_at desc`,
    ));
    return { boards: result.rows };
  });

  app.get("/v1/tasks/monitor", async (request, reply) => {
    const identity = requirePermission(request, reply, ["tasks.manage"]);
    if (!identity || !canManageTasks(identity)) return identity && reply.code(403).send({ error: "forbidden" });
    const cards = await db.transaction(identity, async (client) => {
      const values = [];
      let scope = "";
      if (!identity.roles.includes("super_admin")) {
        values.push(identity.id);
        scope = `and (c.intern_id is null or exists(
          select 1 from utero_academy.mentor_profiles mp
          join utero_academy.mentor_assignments ma on ma.mentor_id = mp.id
          where mp.user_id = $1 and ma.intern_id = c.intern_id
            and ma.started_at <= (now() at time zone 'Asia/Jakarta')::date
            and (ma.ended_at is null or ma.ended_at >= (now() at time zone 'Asia/Jakarta')::date)
        ))`;
      }
      const result = await client.query(
        `select c.id,c.title,c.description,c.priority,c.due_at,c.created_by,c.intern_id,c.list_id,
          l.board_id,l.name as list_name,b.name as board_name,
          coalesce(ip.full_name,'Belum ditugaskan') as intern_name,
          coalesce(up.full_name,'Sistem') as creator_name
         from utero_academy.task_cards c
         join utero_academy.task_lists l on l.id=c.list_id
         join utero_academy.task_boards b on b.id=l.board_id
         left join utero_academy.intern_profiles ip on ip.id=c.intern_id
         left join utero_academy.user_profiles up on up.id=c.created_by
         where true ${scope} order by c.created_at desc`, values,
      );
      return result.rows;
    });
    return { cards };
  });

  app.get("/v1/tasks/boards/:id", async (request, reply) => {
    const identity = requirePermission(request, reply, ["tasks.manage"]);
    if (!identity || !canManageTasks(identity)) return identity && reply.code(403).send({ error: "forbidden" });
    if (!validId(request.params.id)) return reply.code(400).send({ error: "invalid_board_id" });
    const board = await db.transaction(identity, async (client) => {
      const boards = await client.query("select * from utero_academy.task_boards where id = $1", [request.params.id]);
      if (!boards.rows[0]) return null;
      const lists = await client.query("select * from utero_academy.task_lists where board_id = $1 order by order_index", [request.params.id]);
      const scoped = identity.roles.includes("super_admin") ? "" : `and (c.intern_id is null or exists(
        select 1 from utero_academy.mentor_profiles mp
        join utero_academy.mentor_assignments ma on ma.mentor_id=mp.id
        where mp.user_id=$2 and ma.intern_id=c.intern_id
          and ma.started_at <= (now() at time zone 'Asia/Jakarta')::date
          and (ma.ended_at is null or ma.ended_at >= (now() at time zone 'Asia/Jakarta')::date)
      ))`;
      const cards = await client.query(
        `select c.*,coalesce(ip.full_name,'Belum ditugaskan') intern_name,coalesce(up.full_name,'Sistem') creator_name
         from utero_academy.task_cards c join utero_academy.task_lists l on l.id = c.list_id
         left join utero_academy.intern_profiles ip on ip.id=c.intern_id
         left join utero_academy.user_profiles up on up.id=c.created_by
         where l.board_id = $1 ${scoped} order by c.order_index`,
        identity.roles.includes("super_admin") ? [request.params.id] : [request.params.id, identity.id],
      );
      const cardIds = cards.rows.map((card) => card.id);
      const [checklists, subtasks, attachments] = cardIds.length ? await Promise.all([
        client.query("select * from utero_academy.task_checklists where card_id = any($1::uuid[]) order by order_index", [cardIds]),
        client.query("select * from utero_academy.task_subtasks where card_id = any($1::uuid[]) order by order_index", [cardIds]),
        client.query("select * from utero_academy.task_attachments where card_id = any($1::uuid[]) order by created_at desc", [cardIds]),
      ]) : [{ rows: [] }, { rows: [] }, { rows: [] }];
      const creatorIds = [...new Set(cards.rows.map((card) => card.created_by).filter(Boolean))];
      const profiles = creatorIds.length
        ? await client.query("select id,full_name from utero_academy.user_profiles where id = any($1::uuid[])", [creatorIds])
        : { rows: [] };
      return { board: { ...boards.rows[0], task_lists: lists.rows.map((list) => ({
        ...list, task_cards: cards.rows.filter((card) => card.list_id === list.id).map((card) => ({
          ...card,
          task_checklists: checklists.rows.filter((item) => item.card_id === card.id),
          task_subtasks: subtasks.rows.filter((item) => item.card_id === card.id),
          task_attachments: attachments.rows.filter((item) => item.card_id === card.id),
        })),
      })) }, userProfiles: profiles.rows };
    });
    if (!board) return reply.code(404).send({ error: "board_not_found" });
    return board;
  });

  app.get("/v1/tasks/cards", async (request, reply) => {
    const identity = requireIdentity(request, reply);
    if (!identity) return;
    if (!identity.roles.includes("intern") && !identity.roles.includes("super_admin")) return reply.code(403).send({ error: "forbidden" });
    const requested = request.query?.internId;
    if (requested && !validId(requested)) return reply.code(400).send({ error: "invalid_intern_id" });
    const result = await db.transaction(identity, async (client) => {
      const profileId = identity.roles.includes("super_admin") && requested
        ? requested
        : await internProfile(client, identity);
      if (!profileId) return { cards: [], profileId: null };
      if (identity.roles.includes("super_admin") && requested) {
        const exists = await client.query("select 1 from utero_academy.intern_profiles where id = $1", [profileId]);
        if (!exists.rowCount) return null;
      }
      const cards = await client.query("select * from utero_academy.task_cards where intern_id = $1 order by created_at desc", [profileId]);
      const ids = cards.rows.map((card) => card.id);
      if (!ids.length) return { cards: [], profileId };
      const [checklists, subtasks, attachments] = await Promise.all([
        client.query("select * from utero_academy.task_checklists where card_id = any($1::uuid[]) order by order_index", [ids]),
        client.query("select * from utero_academy.task_subtasks where card_id = any($1::uuid[]) order by order_index", [ids]),
        client.query("select * from utero_academy.task_attachments where card_id = any($1::uuid[]) order by created_at desc", [ids]),
      ]);
      return { profileId, cards: cards.rows.map((card) => ({ ...card,
        task_checklists: checklists.rows.filter((item) => item.card_id === card.id),
        task_subtasks: subtasks.rows.filter((item) => item.card_id === card.id),
        task_attachments: attachments.rows.filter((item) => item.card_id === card.id),
      })) };
    });
    if (result === null) return reply.code(404).send({ error: "intern_not_found" });
    if (request.query?.internId && request.query.internId !== result.profileId) return reply.code(404).send({ error: "intern_not_found" });
    return { cards: result.cards };
  });
}
